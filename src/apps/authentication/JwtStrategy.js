"use strict";

var util = require('util');
var passport = require('passport');
var _ = require('lodash');
var BluebirdPromise = require('sequelize').Promise;
var jwt = require('jsonwebtoken');
var verifyJwt = BluebirdPromise.promisify(jwt.verify);
var ApiError = require('../../ApiError.js');
var getApiKey = require('../helpers/getApiKey');


function JwtStrategy(jwtExtractor, apiKeyIdExtractor) {
    this.name = 'jwt';
    //the jwt extractor extracts the JWT from the request
    this.jwtExtractor = jwtExtractor;
    //the API key extractor extracts the API key ID from the decoded jwt
    this.apiKeyIdExtractor = apiKeyIdExtractor;
}

util.inherits(JwtStrategy, passport.Strategy);

JwtStrategy.prototype.authenticate = function (req) {
    BluebirdPromise.try(() => {
        var token = this.jwtExtractor(req);
        ApiError.assert(token, 'No auth token');
        var apiKeyId = this.apiKeyIdExtractor(jwt.decode(token, {complete: true}));
        ApiError.assert(apiKeyId, 'no API key Id');
        return getApiKey(apiKeyId)
            .tap(_.partial(ApiError.assert, _, 'no API key'))
            .then(apiKey => verifyJwt(token, apiKey.secret).then(_.partial(this.success, apiKey)));
    })
    .catch(this.fail);
};

module.exports = JwtStrategy;