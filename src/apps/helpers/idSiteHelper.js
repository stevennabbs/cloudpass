'use strict';

var signJwt = require('sequelize').Promise.promisify(require('jsonwebtoken').sign);
var _ = require('lodash');
var getApiKey = require('./getApiKey');
var models = require('../../models');

exports.idSiteHeaders = function(req, res, next){
    
    if(req.authInfo) {
        //when login attempts are made from the ID site, no content must be send
        //but instead the Stormpath-SSO-Redirect-Location header must be set
        if(req.path.endsWith('loginAttempts')){
            var initialJson = res.json;
            res.json = function(result){
                //check if the attempt was successful
                if(result.account && result.account.href){
                    getApiKey(
                        req.authInfo.sub,
                        [{
                            model: models.tenant,
                            include: [{
                                model: models.idSite,
                                limit: 1
                            }]
                        }]
                    ).then(function(apiKey){
                        return getJwtResponse(
                                apiKey,
                                req.authInfo.cb_uri,
                                req.authInfo.init_jti,
                                false,
                                result.account.href);
                    })
                    .then(function(jwtResponse){
                       res.set('Access-Control-Expose-Headers', ['Stormpath-SSO-Redirect-Location']);
                       //don't redirect directly to the app, redirect first to cloudpass so it can set a cookie
                       res.set('Stormpath-SSO-Redirect-Location', models.getRootUrl(req.authInfo.app_href)+"/sso?jwtResponse="+jwtResponse);
                       res.send();
                    })
                    .catch(next);
                } else {
                    //proceed normally
                    initialJson.call(res, result);
                }
            };
        }
        
        //re-send an updated token as Authorization header
        signJwt(
            _.omit(req.authInfo, ['jti', 'iat', 'exp']),
            req.app.get('secret'),
            {expiresIn: 300}
        )
        .then(function(token){
            res.set('Authorization', 'Bearer '+token);
            res.set('Access-Control-Expose-Headers', ['Authorization']);
            next();
        })
        .catch(next);

  } else {
      next();
  }
};

// returns an Jwt response that can be used by the application to authenticate a user
function getJwtResponse(apiKey, cbUri, initialJwtId, isNewSub, accountHref){
    //jwt to use in the redirection query
    return signJwt(
        {
            isNewSub: isNewSub,
            status: "AUTHENTICATED",
            cb_uri: cbUri,
            irt: initialJwtId
        },
        apiKey.secret,
        {
            expiresIn: 60,
            issuer: apiKey.tenant.idSites[0].url,
            subject: accountHref,
            header: {kid: apiKey.id}
        }
    );
}
exports.getJwtResponse = getJwtResponse;