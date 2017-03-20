'use strict';

var express = require('express');
var cookieParser = require('cookie-parser');
var moment = require('moment');
var BluebirdPromise = require('sequelize').Promise;
var jwt = BluebirdPromise.promisifyAll(require('jsonwebtoken'));
var _ = require('lodash');
var passport = require('passport');
var Optional = require('optional-js');
var url = require('url');
var config = require('config');
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

const cookiePath = url.parse(Optional.ofNullable(config.get('server.rootUrl')).orElse('')+'/sso/').pathname;

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
                            .then(cookieJwt => BluebirdPromise.join(cookieJwt.mfa, accountStore.getAccounts({where: {id: cookieJwt.sub}, limit:1}).get(0)))
                            .spread((verifiedMfa, account) => {
                                ApiError.assert(account, Error, 'account not found in account store');
                                return _.cond([
                                    [
                                        //if the user didn't authenticate with one of the requested factor, redirect to ID site with factors scope
                                        authInfo => !_.isEmpty(authInfo.require_mfa) && !_.includes(authInfo.require_mfa, verifiedMfa),
                                        authInfo => redirectToIdSite(
                                                res,
                                                req.user,
                                                application,
                                                accountStore,
                                                authInfo,
                                                {scope: idSiteHelper.getFactorsScope(account.id)}
                                        )
                                    ],
                                    [
                                        //if the settings page is requested, redirect to ID site with the right scope
                                        _.matchesProperty('path', '/#/settings'),
                                        authInfo => redirectToIdSite(
                                                        res,
                                                        req.user,
                                                        application,
                                                        accountStore,
                                                        authInfo,
                                                        {
                                                            scope: idSiteHelper.getSecuritySettingsScope(account.id),
                                                            authenticated: true,
                                                            require_mfa: ['google-authenticator']
                                                        }
                                        )
                                    ],
                                    [
                                        //else redirect to the application directly
                                        _.stubTrue,
                                        () => idSiteHelper.getJwtResponse(
                                                req.user,
                                                account.href,
                                                {
                                                    isNewSub: false,
                                                    status: "AUTHENTICATED",
                                                    cb_uri: req.authInfo.cb_uri,
                                                    irt: req.authInfo.jti,
                                                    state: req.authInfo.state,
                                                    inv_href: req.authInfo.inv_href
                                                }
                                            )
                                            .then(sendJwtResponse(res, req.authInfo.cb_uri))
                                    ]
                                ])(req.authInfo);
                            })
                        // Either jwt expired or the account does not belong to the account store
                        //  => re-authentication required
                        .catch(() => redirectToIdSite(res, req.user, application, accountStore, req.authInfo));
                }
                return redirectToIdSite(res, req.user, application, accountStore, req.authInfo);
            })
            .catch(req.next);

    } else if (req.query.jwtResponse) {
        //the user was redirected from the ID site to here, and we must redirect it back to the application
        //make a jwt cookie from the account ID
        jwt.signAsync(
            {
                mfa: req.authInfo.mfa
            },
            req.app.get('secret'),
            {
                subject: models.resolveHref(req.authInfo.sub).id,
                expiresIn: moment.duration(req.user.tenant.idSites[0].sessionTtl).asSeconds()
            }
        )
        .then(function(cookieToken){
            var cookieOptions = {
                httpOnly: true,
                path: cookiePath
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
    res.clearCookie(req.user.tenant.id, {path: cookiePath})
      .status(302)
      .location(req.authInfo.cb_uri)
      .send();
});

app.use(errorHandler);

function redirectToIdSite(res, apiKey, application, accountStore, jwtPayload, content){
    const baseUrl = hrefHelper.getBaseUrl(jwtPayload.sub);

    //if an invitation has been provided, check if the account already exists in the application
    //if not, redirect to the registration page
    BluebirdPromise.resolve(
        Optional.ofNullable(jwtPayload.inv_href)
            .map(href => models.resolveHref(href)
                            .reload()
                            .then(i => accountStore.getAccounts({where: {email: _.toLower(i.email)}, limit:1}).get(0)
                            .then(account => Optional.ofNullable(account).map(a => [jwtPayload.path, a.email]).orElseGet(() => ['/#/register', i.email])))
            )
            .orElseGet(() => [jwtPayload.path, null])
    ).spread((path, email) =>
        jwt.signAsync(
           _.merge(
               {
                   init_jti: jwtPayload.jti,
                   scope: scopeHelper.getIdSiteScope(application, accountStore),
                   app_href: jwtPayload.sub,
                   cb_uri: jwtPayload.cb_uri,
                   state: jwtPayload.state,
                   asnk: jwtPayload.onk,
                   sof: jwtPayload.sof,
                   require_mfa: jwtPayload.require_mfa,
                   //qualify the account store & invitation hrefs
                   ash: baseUrl + hrefHelper.unqualifyHref(accountStore.href),
                   inv_href: Optional.ofNullable(jwtPayload.inv_href).map(_.bindKey(baseUrl, 'concat')).orElse(undefined),
                   email: email,
                   //only to not make stormpath.js crash
                   sp_token: 'null'
               },
               content
           ),
           apiKey.secret,
           {
               expiresIn: 60,
               subject: jwtPayload.iss,
               audience: 'idSite'
           }
       ).then(token => res.status(302).location(apiKey.tenant.idSites[0].url+_.defaultTo(path, '/#/')+'?jwt='+token).send())
    );
}

module.exports = app;