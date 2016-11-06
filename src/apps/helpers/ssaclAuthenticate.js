'use strict';

var passport = require('passport');
var ApiError = require('../../ApiError.js');

//authenticate the user and call the following middlewares with the actor set in SAACL CLS.
module.exports = function(...strategies){
    return function (req, res, next) {
        //don't authenticate for CORS 'OPTIONS' requests
        //or if the user is already authenticated by previous middlewares
        if(req.method === 'OPTIONS' || req.user){
          next();
        } else {
            passport.authenticate(
                strategies,
                {session: false},
                function (err, user, info) {
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
        }
    };
};