'use strict';

var express = require('express');
var cookieParser = require('cookie-parser');
var moment = require('moment');
var BluebirdPromise = require('sequelize').Promise;
var jwt = BluebirdPromise.promisifyAll(require('jsonwebtoken'));
var url = require('url');
var _ = require('lodash');
var models = require('../models');
var scopeHelper = require('./helpers/scopeHelper');
var getApiKey = require('./helpers/getApiKey');
var idSiteHelper = require('./helpers/idSiteHelper');
var ApiError = require('../ApiError');

var app = express();
app.use(cookieParser());


function verifyApiKeySignedJwt(token, apiKey){
    return getApiKey(
            //find the API key the JWT was signed with
            apiKey,
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
                    jwt.verifyAsync(token, apiKey.secret, {algorithms: ["HS256"]}),
                    apiKey);
        });
}

app.get('/', function(req, res){

    if(req.query.jwtRequest){
        // the user was redirected from the application to here, and we must redirect it back to the ID site
        //the api key is the JWT issuer
        verifyApiKeySignedJwt(req.query.jwtRequest, jwt.decode(req.query.jwtRequest).iss)
            .spread(function(payload, apiKey){
                var application = models.resolveHref(payload.sub);
                var cookie = req.cookies[apiKey.tenantId];
                if(cookie){
                    //the user already authenticated for this tenant
                    //check if his account belongs to the requested application
                    return jwt.verifyAsync(cookie, req.app.get('secret'), {algorithms: ["HS256"]})
                        .get('sub')
                        .then(function(accountId){
                            return application.getAccounts({where: {id: accountId}, limit:1, actor: apiKey.tenantId});
                        })
                        .spread(function(account){
                            ApiError.assert(account, 'account not found in application');
                            return idSiteHelper.getJwtResponse(apiKey, payload.cb_uri, payload.jti, false, account.href, payload.state)
                                .then(function(redirectUrl){
                                    res.status(302).location(addParamToUri(payload.cb_uri, 'jwtResponse', redirectUrl)).send();
                                });
                        })
                        .catch(function(){
                            // jwt expired or the account does not belong to the application => re-authentication required
                            return redirectToIdSite(payload, application, apiKey, res);
                        });
                }
                return redirectToIdSite(payload, application, apiKey, res);
            })
            .catch(res.next);

    } else if (req.query.jwtResponse) {
        //the user was redirected from the ID site to here, and we must redirect it back to the application
        //the api key is the JWT audience
        verifyApiKeySignedJwt(req.query.jwtResponse, jwt.decode(req.query.jwtResponse, {complete: true}).header.kid)
                .spread(function(payload, apiKey){
                    //make a jwt cookie from the account ID
                    return BluebirdPromise.join(
                        jwt.signAsync(
                            {},
                            req.app.get('secret'),
                            {
                                subject: models.resolveHref(payload.sub).id,
                                expiresIn: moment.duration(apiKey.tenant.idSites[0].sessionTtl).asSeconds()
                            }
                        ),
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
        verifyApiKeySignedJwt(req.query.jwtRequest, jwt.decode(req.query.jwtRequest).iss)
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
    //TODO use passortSsacl
    var ssaclCls = res.app.get('ssaclCls');
    return ssaclCls.run(function(){
        ssaclCls.set('actor', apiKey.tenantId);
        return application.getLookupAccountStore(jwtPayload.onk)
            .then( as => jwt.signAsync(
                {
                    init_jti: jwtPayload.jti,
                    scope: scopeHelper.getIdSiteScope(application, as),
                    app_href: jwtPayload.sub,
                    cb_uri: jwtPayload.cb_uri,
                    state: jwtPayload.state,
                    asnk: jwtPayload.onk,
                    sof: jwtPayload.sof,
                    ash: as.href,
                    sp_token: 'null' //only to not make stormpath.js crash
                },
                apiKey.secret,
                {
                    expiresIn: 60,
                    subject: jwtPayload.iss,
                    audience: 'idSite'
                }
            ))
            .then(token => res.status(302).location(apiKey.tenant.idSites[0].url+_.defaultTo(jwtPayload.path, '/#/')+'?jwt='+token).send());
    });
}

module.exports = app;