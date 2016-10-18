'use strict';

var express = require('express');
var morgan = require('morgan');
var bodyParser = require('body-parser');
var config = require('config');
var BluebirdPromise = require('sequelize').Promise;
var _ = require('lodash');
var passport = require('passport');
var Optional = require('optional-js');
var SAuthc1Strategy = require('./authentication/SAuthc1Strategy');
var BasicStrategy = require('passport-http').BasicStrategy;
var JwtStrategy = require('passport-jwt').Strategy;
var ExtractJwt = require('passport-jwt').ExtractJwt;
var JwtCookieComboStrategy = require('passport-jwt-cookiecombo');
var idSiteHelper = require('./helpers/idSiteHelper');
var scopeChecker = require('./helpers/scopeChecker');
var SwaggerExpress = BluebirdPromise.promisifyAll(require('swagger-express-mw'));
var ApiError = require('../ApiError.js');
var getApiKey = require('./helpers/getApiKey');

module.exports = function(secret){
    // register SAuthc1 authentication strategy
    passport.use(new SAuthc1Strategy(
        function(apiKeyId){
            return getApiKey(apiKeyId)
                    .then(function(apiKey){
                        if(apiKey){
                            return [apiKey, apiKey.secret];
                        }
                    });
        },
        config.get('server.rootUrl')
    ));

    passport.use(new JwtStrategy(
        {
            secretOrKey : secret,
            jwtFromRequest: ExtractJwt.fromExtractors([
                //ID sites send request with a JWT in the authorization header
                ExtractJwt.fromAuthHeaderWithScheme('Bearer'),
                //SAML identity providers use the 'RelayState' POST param
                ExtractJwt.fromBodyField('RelayState')
            ])
        },
        function(payload, done) {
            BluebirdPromise.join(getApiKey(payload.sub), payload)
                .spread(_.partial(done, null))
                .catch(_.partial(done, _, false));
        }
    ));

    //admins can be authenticated by a cookie set by the /login endpoint
    passport.use(new JwtCookieComboStrategy(
        {
            secretOrPublicKey: secret,
            jwtCookieName: 'sessionToken',
            jwtVerifyOptions: {
                algorithms: ["HS256"],
                audience: 'admin'
            }
        },
        function(payload, done){
            return done(null, payload);
        }
    ));

    // basic authentication with API key & secret
    passport.use(new BasicStrategy(
        function(apiKeyId, providedSecret, done){
            getApiKey(apiKeyId)
                    .then(function(apiKey){
                        done(
                            null,
                            Optional.ofNullable(apiKey)
                               .filter(_.flow(_.property('secret'), _.partial(_.eq, providedSecret)))
                               .orElse(false)
                        );
            })
            .catch(done);
        }
    ));

    return SwaggerExpress
        .createAsync({
            appRoot: process.cwd()+'/src',
            configDir: '../config',
            swaggerFile: 'swagger/swagger.yaml'
        })
        .then(function(swaggerExpress){

            var app = express();
            app.use(morgan('tiny'));
            //Sauthc1 needs the raw body
            app.use(bodyParser.json({
                verify: function(req, res, buf) {
                    req.rawBody = buf;
                }
            }));
            app.use(passport.initialize());
            app.use(bodyParser.urlencoded({ extended: false }));

            //authenticate the requests
            app.use(function (req, res, next) {
                //CORS 'OPTIONS' requests must not be authenticated
                if(req.method === 'OPTIONS'){
                    return next();
                }
                passport.authenticate(['sauthc1', 'jwt', 'jwt-cookiecombo', 'basic'], {session: false}, function (err, user, info) {
                    if (err) {
                        return next(err);
                    }
                    if (!user) {
                        return ApiError.UNAUTHORIZED.write(res);
                    }
                    req.user = user;
                    req.authInfo = info;
                    var ssaclCls = req.app.get('ssaclCls');
                    ssaclCls.run(function(){
                        ssaclCls.set('actor', user.tenantId);
                        next();
                    });
                })(req, res, next);
            });

            //check if the authorized request scope match the current request
            app.use(scopeChecker);

            //add some custom headers for ID sites
            app.use(idSiteHelper.idSiteHeaders);

            // register swagger API
            swaggerExpress.register(app);

            // Custom error handler that return JSON errors
            app.use(function (err, req, res, next) {
                if (res.headersSent) {
                    return next(err);
                }
                var error;
                if(err.allowedMethods){
                    //HTTP method not suported
                    error = new ApiError(405, 405, 'Request method \''+req.method+'\' not supported (supported method(s): '+err.allowedMethods.join()+')');
                } else if(err.statusCode === 400 || _.startsWith(err.message, 'Validation error') || err.name === 'SequelizeValidationError'){
                    //ill-formed query or sequelize validation error
                    error = ApiError.BAD_REQUEST(_.isEmpty(err.errors)?err.message:err.errors[0].message);
                } else if (err.failedValidation){
                    //swagger validation errors, keep the first one
                    error = ApiError.BAD_REQUEST(_.isEmpty(err.results)?err.message:err.results.errors[0].message);
                } else if(err.name === 'SequelizeUniqueConstraintError'){
                    error = new ApiError(400, 2001, err.errors.length > 0 ? err.errors[0].message+' ('+err.errors[0].value+')': err.message);
                } else {
                    error = ApiError.FROM_ERROR(err);
                }
                if(error.status === 500){
                    console.error(JSON.stringify(err));
                    console.error(err.stack);
                }
                error.write(res);
            });

            return app;
    });
};