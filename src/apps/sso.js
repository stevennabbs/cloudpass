'use strict';

var express = require('express');
var cookieParser = require('cookie-parser');
var moment = require('moment');
var BluebirdPromise = require('sequelize').Promise;
var jwt = BluebirdPromise.promisifyAll(require('jsonwebtoken'));
var _ = require('lodash');
var passport = require('passport');
var models = require('../models');
var scopeHelper = require('../helpers/scopeHelper');
var idSiteHelper = require('./helpers/idSiteHelper');
var ssaclAuthenticate = require('./helpers/ssaclAuthenticate');
var sendJwtResponse = require('./helpers/sendJwtResponse');
var errorHandler = require('./helpers/errorHandler');
var ApiError = require('../ApiError');
var JwtStrategy = require('./authentication/JwtStrategy');
var hrefHelper = require('../helpers/hrefHelper');


function ssoStrategy(queryParameter, apiKeyIdPath){
  return new JwtStrategy(
      _.property('query.'+queryParameter),
      _.property(apiKeyIdPath),
      {
        model: models.tenant,
        include: [{
            model: models.idSite,
            limit: 1
        }]
      }
  );
}

passport.use('sso-jwt-request', ssoStrategy('jwtRequest', 'payload.iss'));
passport.use('sso-jwt-response', ssoStrategy('jwtResponse', 'header.kid'));

var app = express();
app.use(cookieParser());
app.use(passport.initialize());
app.use('/', ssaclAuthenticate('sso-jwt-request', 'sso-jwt-response'));
app.use('/logout', ssaclAuthenticate('sso-jwt-request'));

app.get('/', function(req, res){

    if(req.query.jwtRequest){
        // the user was redirected from the application to here, and we must redirect it back to the ID site
        var application = models.resolveHref(req.authInfo.sub);
         application.getLookupAccountStore(req.authInfo.onk)
            .then(function(accountStore){
                var cookie = req.cookies[req.user.tenantId];
                if(cookie){
                    //the user already authenticated for this tenant
                    //check if his account belongs to the requested account store
                    return jwt.verifyAsync(cookie, req.app.get('secret'), {algorithms: ["HS256"]})
                        .get('sub')
                        .then(function(accountId){
                            return accountStore.getAccounts({where: {id: accountId}, limit:1, actor: req.user.tenantId});
                        })
                        .spread(function(account){
                            ApiError.assert(account, 'account not found in account store');
                            return idSiteHelper.getJwtResponse(req.user, req.authInfo.cb_uri, req.authInfo.jti, false, account.href, req.authInfo.state)
                                    .then(sendJwtResponse(res, req.authInfo.cb_uri));
                        })
                        .catch(function(){
                            // jwt expired or the account does not belong to the account store => re-authentication required
                            return redirectToIdSite(req.authInfo, application, accountStore, req.user, res);
                        });
                }
                return redirectToIdSite(req.authInfo, application, accountStore, req.user, res);
            })
            .catch(req.next);

    } else if (req.query.jwtResponse) {
        //the user was redirected from the ID site to here, and we must redirect it back to the application
        //make a jwt cookie from the account ID
        jwt.signAsync(
            {},
            req.app.get('secret'),
            {
                subject: models.resolveHref(req.authInfo.sub).id,
                expiresIn: moment.duration(req.user.tenant.idSites[0].sessionTtl).asSeconds()
            }
        )
        .then(function(cookieToken){
            var cookieOptions = {
                httpOnly: true,
                path: '/sso'
            };
            if(req.user.tenant.idSites[0].sessionCookiePersistent){
                cookieOptions.maxAge =  moment.duration(req.user.tenant.idSites[0].sessionTtl).asMilliseconds();
            }
            res.cookie(req.user.tenant.id, cookieToken, cookieOptions);
            sendJwtResponse(res, req.authInfo.cb_uri)(req.query.jwtResponse);
        })
        .catch(req.next);
    } else {
        req.next();
    }
});

app.get('/logout', function(req, res){
    res.clearCookie(req.user.tenant.id, {path: '/sso'})
      .status(302)
      .location(req.authInfo.cb_uri)
      .send();
});

app.use(errorHandler);

function redirectToIdSite(jwtPayload, application, accountStore, apiKey, res){
    return jwt.signAsync(
        {
            init_jti: jwtPayload.jti,
            scope: scopeHelper.getIdSiteScope(application, accountStore),
            app_href: jwtPayload.sub,
            cb_uri: jwtPayload.cb_uri,
            state: jwtPayload.state,
            asnk: jwtPayload.onk,
            sof: jwtPayload.sof,
            require_mfa: jwtPayload.require_mfa,
            //qualify the account store href
            ash: hrefHelper.getBaseUrl(jwtPayload.sub) + hrefHelper.unqualifyHref(accountStore.href),
            //only to not make stormpath.js crash
            sp_token: 'null'
        },
        apiKey.secret,
        {
            expiresIn: 60,
            subject: jwtPayload.iss,
            audience: 'idSite'
        }
    )
    .then(token => res.status(302).location(apiKey.tenant.idSites[0].url+_.defaultTo(jwtPayload.path, '/#/')+'?jwt='+token).send());
}

module.exports = app;