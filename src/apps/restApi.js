'use strict';

var express = require('express');
var morgan = require('morgan');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var config = require('config');
var BluebirdPromise = require('sequelize').Promise;
var _ = require('lodash');
var passport = require('passport');
var SAuthc1Strategy = require('./authentication/SAuthc1Strategy');
var JwtCookieStrategy = require('./authentication/JwtCookieStrategy');
var BasicStrategy = require('passport-http').BasicStrategy;
var BearerStrategy = require('passport-http-bearer');
var jwt = require('jsonwebtoken');
var idSiteHelper = require('./helpers/idSiteHelper');
var scopeChecker = require('./helpers/scopeChecker');
var SwaggerExpress = BluebirdPromise.promisifyAll(require('swagger-express-mw'));
var ApiError = require('../ApiError.js');
var getApiKey = require('./helpers/getApiKey');

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
//register Bearer strategy, used by ID site
passport.use(new BearerStrategy(
    {passReqToCallback: true},
    function(req, token, done){
        BluebirdPromise.promisify(jwt.verify)(token, req.app.get('secret'), {algorithms: ["HS256"]})
            .then(function(payload){
                return BluebirdPromise.join(
                    getApiKey(payload.sub),
                    payload);
            })
            .spread(function(apiKey, payload){
                if(!apiKey){
                    return done(null, false);
                } else {
                    return done(null, apiKey, payload);
                }
            })
            .catch(function(){
                //probably invalid signature or expired token
                return done(null, false);
            });
    }
));
//register JwtCookie authentication strategy
passport.use(new JwtCookieStrategy('sessionToken', 'secret', {algorithms: ["HS256"], audience: 'admin'}));
// register HTTP basic authentication strategy
passport.use(new BasicStrategy(
    function(apiKeyId, secret, done){
        getApiKey(apiKeyId)
                .then(function(apiKey){
                    done(null, !apiKey || apiKey.secret !== secret ? false : apiKey);
        })
        .catch(done);
    }
));

module.exports = SwaggerExpress
    .createAsync({
        appRoot: process.cwd()+'/src',
        configDir: '../config',
        swaggerFile: 'swagger/swagger.yaml'
    })
    .then(function(swaggerExpress){

        var app = express();
        app.use(morgan('tiny'));
        app.use(cookieParser());
        //Sauthc1 needs the raw body
        app.use(bodyParser.json({
            verify: function(req, res, buf) {
                req.rawBody = buf;
            }
        }));
        app.use(passport.initialize());

        //authenticate the requests
        app.use(function (req, res, next) {
            //CORS 'OPTIONS' requests must not be authenticated
            if(req.method === 'OPTIONS'){
                return next();
            }
            passport.authenticate(['sauthc1', 'bearer', 'jwtcookie', 'basic']  , {session: false}, function (err, user, info) {
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
            var error = null;
            if(err.allowedMethods){
                //HTTP method not suported
                error = new ApiError(405, 405, 'Request method \''+req.method+'\' not supported (supported method(s): '+err.allowedMethods.join()+')');
            } else if(err.statusCode === 400){
                //ill-formed query
                error = ApiError.BAD_REQUEST(_.isEmpty(err.errors)?err.message:err.errors[0].message);
            } else if (err.failedValidation){
                //swagger validation errors, keep the first one
                error = ApiError.BAD_REQUEST(_.isEmpty(err.results)?err.message:err.results.errors[0].message);
            } else if(err.name === 'SequelizeUniqueConstraintError' && err.errors.length > 0){
                error = new ApiError(400, 2001, err.errors[0].message+' ('+err.errors[0].value+')');
            } else if (_.startsWith(err.message, 'Validation error') || err.name === 'SequelizeValidationError'){
                //sequelize validation error
                 error = ApiError.BAD_REQUEST(_.isEmpty(err.errors)?err.message:err.errors[0].message);
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
