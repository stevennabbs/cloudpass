'use strict';

var _ = require('lodash');
var BluebirdPromise = require('sequelize').Promise;
var signJwt = BluebirdPromise.promisify(require('jsonwebtoken').sign);
var shimmer = require('shimmer');
var Optional = require('optional-js');
var getApiKey = require('./getApiKey');
var idSiteHelper = require('./idSiteHelper');
var models = require('../../models');
var hrefHelper = require('../../helpers/hrefHelper');
var scopeHelper = require('../../helpers/scopeHelper');

function applyToIdSiteRequests(middleware) {
  return function(req, res) {
    if (_.get(req, 'authInfo.aud') === 'idSite') {
      return middleware(req, res);
    } else {
      req.next();
    }
  };
}

function setAuthorizationBearer(req, res){
  return signJwt(
      _.omit(req.authInfo, ['jti', 'iat', 'exp']),
      req.user.secret,
      {expiresIn: '1h'}
    )
    .then(function(token) {
      res.set('Authorization', 'Bearer ' + token)
        .set('Access-Control-Expose-Headers', ['Authorization']);
    });
}

//send an updated Authorization header
var updateBearer = applyToIdSiteRequests(function(req, res) {
  return setAuthorizationBearer(req, res)
    .then(req.next)
    .catch(req.next);
});

//set a special header instead of redirecting directly
//because ID sites use ajax calls to request cloudpass
var handleRedirects = applyToIdSiteRequests(function(req, res) {
  shimmer.wrap(res, 'redirect', _.constant(
    function(redirectUrl) {
      this.set('Access-Control-Expose-Headers', ['Stormpath-SSO-Redirect-Location'])
        .set('Stormpath-SSO-Redirect-Location', redirectUrl)
        .send();
    }
  ));
  req.next();
});

var afterAuthentication = function(accountHrefGetter, isNewSub, secondFactor){
  return applyToIdSiteRequests(function(req, res) {
    shimmer.wrap(res, 'json', function(original) {
      return function(result) {
        //check if an account has been returned
        let accountHref = accountHrefGetter(result);
        BluebirdPromise.try(() => {
          if (accountHref) {
            //ask for a second factor if requested
            if(!secondFactor && req.authInfo.require_mfa){
                var accountId = /\/accounts\/(.*)$/.exec(accountHref)[1];
                //add 2nd factors into the request scope
                req.authInfo.scope = scopeHelper.pathsToScope(_.merge(
                    scopeHelper.scopeToPaths(req.authInfo.scope),
                    {accounts: {[accountId]: [{factors: ['get', 'post']}]}}
                ));
                req.authInfo.isNewSub = isNewSub;
                return setAuthorizationBearer(req, this)
                        .then(() => original.call(this, result));
            } else {
                //the user is authenticated: redirect back to the application once
                return getApiKey(
                    req.authInfo.sub, {
                      model: models.tenant,
                      include: [{
                        model: models.idSite,
                        limit: 1
                      }]
                    }
                  )
                  .then(function(apiKey) {
                    return idSiteHelper.getJwtResponse(
                      apiKey,
                      req.authInfo.cb_uri,
                      req.authInfo.init_jti,
                      isNewSub || req.authInfo.isNewSub || false,
                      accountHref,
                      req.authInfo.state);
                  })
                  //don't redirect directly to the app, redirect first to cloudpass so it can set a cookie
                  .then(jwtResponse => this.redirect(hrefHelper.getRootUrl(req.authInfo.app_href) + "/sso?jwtResponse=" + jwtResponse));
            }
          } else {
              return original.call(this, result);
          }

        })
        .catch(req.next);
      };
    });
    req.next();
  });
};

var suppressOutput = applyToIdSiteRequests(function(req, res) {
  shimmer.wrap(res, 'json', original => function(){return original.call(this, {});});
  req.next();
});

//remove the current path from the scope if the request was successful
var alterScope = function(newPathsGetter){
  return applyToIdSiteRequests(function(req, res) {
    shimmer.wrap(res, 'json', function(original) {
      return function(result) {
        BluebirdPromise.try(() => {
          if (this.statusCode === 200) {
            req.authInfo.scope = scopeHelper.pathsToScope(newPathsGetter(scopeHelper.scopeToPaths(req.authInfo.scope), req, result));
            return setAuthorizationBearer(req, this);
          }
        })
        .then(() => original.call(this, result))
        .catch(req.next);
      };
    });
    req.next();
  });
};

//remove the current path from the scope if the request was successful
var removeCurrentPathFromScope = alterScope((oldPaths, req) => _.omit(oldPaths, req.path));
//remove paths to the scope if the request was successful
var addPathsToScope = function(newPathsGetter){
    return alterScope((oldPaths, req, result) => _.merge(oldPaths, newPathsGetter(result)));
};

var hideFactorSecrets = applyToIdSiteRequests(function(req, res) {
    shimmer.wrap(res, 'json', function(original) {
        return function(result) {
            result.items.forEach(_.unary(_.partial(_.assign, _, {secret: null, keyUri: null, base64QRImage: null})));
            return original.call(this, result);
        };
    });
    return req.next();
});

module.exports = function(app) {
  app.use(['/applications/*', '/organizations/*', '/accounts/*', '/factors/*', '/challenges/*'], updateBearer, handleRedirects);
  //handle successful 1st factor: either redirect to application or ask for a 2nd factor
  app.post('/applications/:id/loginAttempts', afterAuthentication(_.property('account.href'), false, false));
  //after account creation, redirect to the application if the email verification workflow is not enabled
  app.post(
    ['/applications/:id/accounts', '/organization/:id/accounts'],
    afterAuthentication(result => Optional.ofNullable(result.href).filter(_.constant(result.status === 'ENABLED')).orElseGet(_.stubFalse), true, false)
  );
  //tokens should not be exposed to the user
  app.post('/applications/:id/passwordResetTokens', suppressOutput);
  //remove tokens from the scope once they have been used
  app.post('/applications/:applicationId/passwordResetTokens/:tokenId', removeCurrentPathFromScope);
  //allow challenging newly created factors
  app.post('/accounts/:id/factors', addPathsToScope(r => ({['/factors/'+r.id+'/challenges']: ['post']})));
  //Hide configured factor sercrets
  app.get('/accounts/:id/factors', hideFactorSecrets);
  //allow challenging verified factors
  app.get('/accounts/:id/factors', addPathsToScope(r => _(r.items)
                                                            .filter(_.matches({verificationStatus :'VERIFIED'}))
                                                            .map(f => ({['/factors/'+f.id+'/challenges']: ['post']}))
                                                            .reduce(_.merge)));
  //allow veryfing created challenges
  app.post('/factors/:id/challenges', addPathsToScope(_.cond([[_.matches({status :'CREATED'}), c => ({['challenges/'+c.id]: ['post']})],[_.stubTrue, _.stubObject]])));
  //handle successful 2nd factor: redirect to application
  app.post(['/challenges/:id', '/factors/:id/challenges'], afterAuthentication(_.cond([[_.matches({status :'SUCCESS'}), _.property('account.href')], [_.stubTrue, _.stubFalse]]), false, true));
};