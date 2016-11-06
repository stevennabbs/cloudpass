'use strict';

var signJwt = require('sequelize').Promise.promisify(require('jsonwebtoken').sign);
var _ = require('lodash');
var shimmer = require('shimmer');
var getApiKey = require('./getApiKey');
var models = require('../../models');
var hrefHelper = require('../../models/helpers/hrefHelper');


exports.idSiteHeaders = function(req, res){
    
    //authInfo is set only when requests are made from ID site or SAML IdP
    if(_.get(req, 'authInfo.aud') === 'idSite') {

        //handle redirects the ID-site way
        shimmer.wrap(res, 'redirect', _.constant(idSiteRedirect));
        
        //redirect the user on successful login attempts
        if(req.path.endsWith('loginAttempts')){
            redirectAfterLoginAttempts(req, res);
        }
        
        //re-send an updated token as Authorization header
        signJwt(
            _.omit(req.authInfo, ['jti', 'iat', 'exp']),
            req.user.secret,
            {expiresIn: '1h'}
        )
        .then(function(token){
            res.set('Authorization', 'Bearer '+token)
               .set('Access-Control-Expose-Headers', ['Authorization']);
            req.next();
        })
        .catch(req.next);

  } else {
      req.next();
  }
};

// returns an Jwt response that can be used by the application to authenticate a user
function getJwtResponse(apiKey, cbUri, initialJwtId, isNewSub, accountHref, state){
    //jwt to use in the redirection query
    return signJwt(
        {
            isNewSub: isNewSub,
            status: "AUTHENTICATED",
            cb_uri: cbUri,
            irt: initialJwtId,
            state: state
        },
        apiKey.secret,
        {
            expiresIn: 60,
            issuer: apiKey.tenant.idSites[0].url,
            subject: accountHref,
            audience: apiKey.id,
            header: {kid: apiKey.id}
        }
    );
}
exports.getJwtResponse = getJwtResponse;

function idSiteRedirect(redirectUrl){
    //set a special header instead of redirecting directly
    //because ID sites use ajax calls to request cloudpass
    this.set('Access-Control-Expose-Headers', ['Stormpath-SSO-Redirect-Location'])
        .set('Stormpath-SSO-Redirect-Location', redirectUrl)
        .send();
}

function redirectAfterLoginAttempts(req, res){
    shimmer.wrap(res, 'json', function (original) {
        return function (result) {
            //check if the attempt was successful
            if(_.has(result, 'account.href')){
                getApiKey(
                    req.authInfo.sub,
                    {
                        model: models.tenant,
                        include: [{
                            model: models.idSite,
                            limit: 1
                        }]
                    }
                )
                .then(function(apiKey){
                    return getJwtResponse(
                            apiKey,
                            req.authInfo.cb_uri,
                            req.authInfo.init_jti,
                            false,
                            result.account.href,
                            req.authInfo.state);
                })
                .then(function(jwtResponse){
                    //don't redirect directly to the app, redirect first to cloudpass so it can set a cookie
                   this.redirect(hrefHelper.getRootUrl(req.authInfo.app_href)+"/sso?jwtResponse="+jwtResponse);
                }.bind(this))
                .catch(req.next);
            } else {
                //proceed normally
                original.call(this, result);
            }
        };
    });
}