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

var afterAuthentication = function(accountHrefGetter, isNewSub, factorTypeGetter){
  return applyToIdSiteRequests(function(req, res) {
    shimmer.wrap(res, 'json', function(original) {
        return function(result) {
            //check if an account has been returned
            let accountHref = accountHrefGetter(result, req);
            if (accountHref) {
                var accountId = /\/accounts\/(.*)$/.exec(accountHref)[1];
                //request a 2nd factor if the user is not already authenticated
                // and the user already configured any or the application requested it
                BluebirdPromise.resolve(
                        Optional.ofNullable(req.authInfo.authenticated ? [] : req.authInfo.require_mfa)
                            .orElseGet(() =>
                                models.factor.findAll({
                                    where: {
                                        accountId,
                                        status: 'ENABLED',
                                        verificationStatus: 'VERIFIED'
                                    }
                                })
                                .map(_.property('type'))
                                .then(_.uniq)
                            )
                )
                .then(requireMfa => {
                    var secondFactor = Optional.ofNullable(factorTypeGetter)
                                        .map(_.method('call', null, result))
                                        .orElse(null);
                    //ask for a second factor if requested
                    if(!_.isEmpty(requireMfa) && !_.includes(requireMfa, secondFactor)){
                        req.authInfo.require_mfa = requireMfa;
                        //add 2nd factors into the request scope
                        req.authInfo.scope = scopeHelper.pathsToScope(_.merge(
                            scopeHelper.scopeToPaths(req.authInfo.scope),
                            idSiteHelper.getFactorsScope(accountId)
                        ));
                        req.authInfo.isNewSub = isNewSub;
                        return setAuthorizationBearer(req, this)
                                .then(() => original.call(this, result));
                    } else {
                        //the user is authenticated: redirect back to the application
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
                                accountHref,
                                {
                                    isNewSub: isNewSub || req.authInfo.isNewSub || false,
                                    status: "AUTHENTICATED",
                                    cb_uri: req.authInfo.cb_uri,
                                    irt: req.authInfo.init_jti,
                                    state: req.authInfo.state,
                                    mfa: secondFactor,
                                    inv_id: req.authInfo.inv_id,
                                    email: req.authInfo.email
                                }
                            );
                          })
                          //don't redirect directly to the app, redirect first to cloudpass so it can set a cookie
                          .then(jwtResponse => this.redirect(hrefHelper.getRootUrl(req.authInfo.app_href) + "/sso?jwtResponse=" + jwtResponse));
                    }
                })
                .catch(req.next);
            } else {
                return original.call(this, result);
            }
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
          if (_.inRange(this.statusCode, 200, 400)) {
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
    return alterScope((oldPaths, req, result) => _.merge(oldPaths, newPathsGetter(result, req)));
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
    app.post('/applications/:id/loginAttempts', afterAuthentication(_.property('account.href'), false));
    //after account creation, redirect to the application if the email verification workflow is not enabled
    app.post(
      ['/applications/:id/accounts', '/organization/:id/accounts'],
      afterAuthentication(result => Optional.ofNullable(result.href).filter(_.constant(result.status === 'ENABLED')).orElseGet(_.stubFalse), true)
    );
    //tokens should not be exposed to the user
    app.post('/applications/:id/passwordResetTokens', suppressOutput);
    //password reset tokens can only be used once
    app.post('/applications/:applicationId/passwordResetTokens/:tokenId', removeCurrentPathFromScope);
    //allow challenging newly created factors
    app.post('/accounts/:id/factors', addPathsToScope(r => ({['/factors/'+r.id+'/challenges']: ['post']})));
    //Hide configured factor sercrets
    app.get('/accounts/:id/factors', hideFactorSecrets);
    //after getting factors:
    // - allow deleting them if the user is authenticated (security settings view)
    // - allow challenging verified factors if he is not authenticated yet
    app.get('/accounts/:id/factors', addPathsToScope(
        (r, req) => req.authInfo.authenticated ?
            _(r.items)
                .map(f => ({['/factors/'+f.id]: ['delete']}))
                .reduce(_.merge) :
            _(r.items)
                .filter(_.matches({verificationStatus :'VERIFIED'}))
                .map(f => ({['/factors/'+f.id+'/challenges']: ['post']}))
                .reduce(_.merge)
    ));
    //allow veryfing created challenges
    app.post('/factors/:id/challenges', addPathsToScope(_.cond([[_.matches({status :'CREATED'}), c => ({['challenges/'+c.id]: ['post']})],[_.stubTrue, _.stubObject]])));
    //handle successful 2nd factor: redirect to application if the user is not yet authenticated
    app.post(['/challenges/:id', '/factors/:id/challenges'], afterAuthentication(
            (result, req) => !req.authInfo.authenticated && result.status === 'SUCCESS' ? result.account.href: null,
            false,
            _.property('type')
     ));
     //redirect to application once the user is done setting up his account (password or multi factor change)
     app.get('/accounts/:id', afterAuthentication(_.property('href'), false));
};