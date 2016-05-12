"use strict";

var util = require('util');
var passport = require('passport');
var Optional = require('optional-js');
var BluebirdPromise = require('sequelize').Promise;
var verifyJwt = BluebirdPromise.promisify(require('jsonwebtoken').verify);

function JwtCookieStrategy(cookieName, secretAppProperty, jwtOptions) {
    this.name = 'jwtcookie';
    this.cookieName = cookieName;
    this.secretAppProperty = secretAppProperty;
    this.jwtOptions = jwtOptions;
}

util.inherits(JwtCookieStrategy, passport.Strategy);

JwtCookieStrategy.prototype.authenticate = function (req) {
    BluebirdPromise.try(function(){
        return Optional.ofNullable(req.cookies[this.cookieName])
            .map(function(cookie){
                   return verifyJwt(
                       cookie,
                       req.app.get(this.secretAppProperty),
                       this.jwtOptions
                   );
            }.bind(this))
            .orElseThrow(function(){
                return 'Cookie not found';
            });
    }.bind(this))
    .then(this.success)
    .catch(this.fail);
};

module.exports = JwtCookieStrategy;