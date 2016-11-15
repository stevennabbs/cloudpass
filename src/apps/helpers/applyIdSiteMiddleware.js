'use strict';

var _ = require('lodash');
var BluebirdPromise = require('sequelize').Promise;
var signJwt = BluebirdPromise.promisify(require('jsonwebtoken').sign);
var shimmer = require('shimmer');
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

//redirect back to the application once the user is authenticated 
var redirectWithAccount = applyToIdSiteRequests(function(req, res) {
  shimmer.wrap(res, 'json', function(original) {
    return function(result) {
      //check if the attempt was successful
      BluebirdPromise.try(() => {
        if (_.has(result, 'account.href')) {
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
                false,
                result.account.href,
                req.authInfo.state);
            })
            //don't redirect directly to the app, redirect first to cloudpass so it can set a cookie
            .then(jwtResponse => this.redirect(hrefHelper.getRootUrl(req.authInfo.app_href) + "/sso?jwtResponse=" + jwtResponse));
        }
      })
      .then(() => original.call(this, result))
      .catch(req.next);
    };
  });
  req.next();
});

var suppressOutput = applyToIdSiteRequests(function(req, res) {
  shimmer.wrap(res, 'json', original => function(){return original.call(this, {});});
  req.next();
});

//remove the current path from the scope if the request was successful
var removeFromScope = applyToIdSiteRequests(function(req, res) {
  shimmer.wrap(res, 'json', function(original) {
    return function(result) {
      BluebirdPromise.try(() => {
        if (this.statusCode === 200) {
          req.authInfo.scope = scopeHelper.pathsToScope(_.omit(scopeHelper.scopeToPaths(req.authInfo.scope), req.path));
          return setAuthorizationBearer(req, this);
        }
      })
      .then(() => original.call(this, result))
      .catch(req.next);
    };
  });
  req.next();
});

module.exports = function(app) {
  app.use(updateBearer);
  app.use(handleRedirects);
  app.post('/applications/:applicationId/loginAttempts', redirectWithAccount);
  //tokens should not be exposed to the user
  app.post('/applications/:applicationId/passwordResetTokens', suppressOutput);
  app.post('/applications/:applicationId/passwordResetTokens/:tokenId', removeFromScope);
};