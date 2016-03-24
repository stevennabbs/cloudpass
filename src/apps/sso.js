'use strict';

var express = require('express');
var jwt = require('jsonwebtoken');
var cookieParser = require('cookie-parser');
var moment = require('moment');
var BluebirdPromise = require('sequelize').Promise;
var url = require('url');
var models = require('../models');
var scopeHelper = require('./helpers/scopeHelper');
var getApiKey = require('./helpers/getApiKey');
var idSiteHelper = require('./helpers/idSiteHelper');
var verifyJwt = BluebirdPromise.promisify(jwt.verify);

var app = express();
app.use(cookieParser());


function verifyApiKeySignedJwt(token, apiKeyField){
    return getApiKey(
            //find the API key with witch the JWT was signed
            jwt.decode(token)[apiKeyField],
            [{
                model: models.tenant,
                include: [{
                    model: models.idSite,
                    limit: 1
                }]
            }]
        )
        .then(function(apiKey){
            //validate the JWT with the API key secret
            return BluebirdPromise.join(
                    verifyJwt(token, apiKey.secret, {algorithms: ["HS256"]}),
                    apiKey);
        });
}

app.get('/', function(req, res){
    
    if(req.query.jwtRequest){
        // the user was redirected from the application to here, and we must redirect it back to the ID site
        //the api key is the JWT issuer
        verifyApiKeySignedJwt(req.query.jwtRequest, 'iss')
            .spread(function(payload, apiKey){
                var application = models.resolveHref(payload.sub);
                var cookie = req.cookies[apiKey.tenantId];
                if(cookie){
                    //the user already authenticated for this tenant
                    //check if his account belongs to the requested application
                    return verifyJwt(cookie, req.app.get('secret'), {algorithms: ["HS256"]})
                        .get('sub')
                        .then(function(accountId){
                            return application.getAccounts({where: {id: accountId}, limit:1, actor: apiKey.tenantId});
                        })
                        .spread(function(account){
                            if(account){
                                return idSiteHelper.getJwtResponse(apiKey, payload.cb_uri, payload.jti, false, account.href)
                                .then(function(redirectUrl){
                                    res.status(302).location(addParamToUri(payload.cb_uri, 'jwtResponse', redirectUrl)).send();
                                });
                            }
                            throw 'account not found in application';
                        })
                        .catch(function(){
                            // jwt expired or the account does not belong to the application => re-authentication required
                            redirectToIdSite(payload, application, apiKey, res);
                        });
                }
                redirectToIdSite(payload, application, apiKey, res);
            })
            .catch(res.next);

    } else if (req.query.jwtResponse) {
        //the user was redirected from the ID site to here, and we must redirect it back to the application
        //the api key is the JWT audience
        verifyApiKeySignedJwt(req.query.jwtResponse, 'aud')
                .spread(function(payload, apiKey){
                    //make a jwt cookie from the account ID
                    return BluebirdPromise.join(
                        BluebirdPromise.fromCallback(function(callback){
                            jwt.sign(
                                {},
                                req.app.get('secret'),
                                {
                                    subject: models.resolveHref(payload.sub).id,
                                    expiresIn: moment.duration(apiKey.tenant.idSites[0].sessionTtl).asSeconds()
                                },
                                callback.bind(null, null)
                            );
                        }),
                        payload,
                        apiKey
                    );
                })
                .spread(function(cookieToken, payload, apiKey){
                    var cookieOptions = {
                        httpOnly: true,
                        path: '/sso'
                    };
                    if(apiKey.tenant.idSites[0].sessionCookiePersistent){
                        cookieOptions.maxAge =  moment.duration(apiKey.tenant.idSites[0].sessionTtl).asMilliseconds();
                    }
                    res.cookie(apiKey.tenant.id, cookieToken, cookieOptions);
                    res.status(302).location(addParamToUri(payload.cb_uri, 'jwtResponse', req.query.jwtResponse)).send();
                })
                .catch(req.next);
    } else {
        req.next();
    }
});

app.get('/logout', function(req, res){
    if(req.query.jwtRequest){
        verifyApiKeySignedJwt(req.query.jwtRequest, 'iss')
            .spread(function(payload, apiKey){
                res.clearCookie(apiKey.tenant.id, {path: '/sso'})
                   .status(302)
                   .location(payload.cb_uri)
                   .send();
            });
    } else {
        req.next();
    }
});

function addParamToUri(uri, paramName, paramValue){
    //just replace the placeholder if it exists
    var placeHolder = '${'+paramName+'}';
    if(uri.includes(placeHolder)){
        return uri.replace(placeHolder, paramValue);
    }
    //else, either add the param to existing params
    //or add a query string to the uri if no param exist
    var parsed = url.parse(uri);
    if(parsed.search){
        parsed.search+='&'+paramName+'='+paramValue;
    } else {
        parsed.search='?'+paramName+'='+paramValue;
    }
    return url.format(parsed);
}

function redirectToIdSite(jwtPayload, application, apiKey, res){
    jwt.sign(
    {
        init_jti: jwtPayload.jti,
        scope: scopeHelper.getIdSiteScope(application.id),
        app_href: jwtPayload.sub,
        cb_uri: jwtPayload.cb_uri,
        state: jwtPayload.state
    },
    res.app.get('secret'),
    {
        expiresIn: 60,
        subject: jwtPayload.iss
    },
    function(token){
        res.status(302).location(apiKey.tenant.idSites[0].url+(jwtPayload.path || '')+'?jwt='+token).send();
    });
}

module.exports = app;