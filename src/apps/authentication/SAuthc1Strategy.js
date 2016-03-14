"use strict";

var util = require('util');
var url = require('url');
var passport = require('passport');
var _ = require('lodash');
var crypto = require('crypto');
var Optional = require('optional-js');
var BluebirdPromise = require('sequelize').Promise;

var AUTHENTICATION_SCHEME = "SAuthc1";
var SAUTHC1_ID = "sauthc1Id";
var ID_TERMINATOR = 'sauthc1_request';
var SAUTHC1_SIGNED_HEADERS = 'sauthc1SignedHeaders';
var SAUTHC1_SIGNATURE = 'sauthc1Signature';
var ALGORITHM = 'HMAC-SHA-256';
var DATE_HEADER = 'x-stormpath-date';

function SAuthc1Strategy(findUserAndSecret, rootUrl) {
    this.name = 'sauthc1';
    this.findUserAndSecret = findUserAndSecret;
    this.rootUrl = rootUrl;
}

util.inherits(SAuthc1Strategy, passport.Strategy);

SAuthc1Strategy.prototype.authenticate = function (req) {
    //authenticate using SAuthc1 authorization header
    //see https://github.com/stormpath/stormpath-sdk-spec/blob/master/specifications/algorithms/sauthc1.md
    
    //the header must start with the authentication scheme and be made of three name value pairs separated by comas
    BluebirdPromise.try(function(){
        var nameValuePairs = Optional.ofNullable(req.headers['authorization'])
                .filter(function(header){return header.substring(0, AUTHENTICATION_SCHEME.length) === AUTHENTICATION_SCHEME;})
                .map(function(header){return header.substring(AUTHENTICATION_SCHEME.length +1);})
                .map(function(authorization){return authorization.split(', ');})
                .filter(function(nameValuePairs){return nameValuePairs.length === 3;})
                .orElseThrow(function(){return 'Invalid authorization header: '+req.headers['authorization'];});

        //first name value pair: sauthc1Id=*apiKeyId*/*dateStamp*/*nonce*/sauthc1_request
        var idParts = Optional.ofNullable(nameValuePairs[0])
                .map(function(nameValue){return nameValue.split('=');})
                .filter(function(nameValueArray){return nameValueArray.length === 2 && nameValueArray[0] === SAUTHC1_ID;})
                .map(function(nameValueArray){return nameValueArray[1].split('/');})
                .filter(function(idParts){return idParts.length === 4 && idParts[3] === ID_TERMINATOR;})
                .orElseThrow(function(){return 'Invalid authorization ID: '+nameValuePairs[0];});

        var apiKeyId = idParts[0];
        var dateStamp = idParts[1];
        var nonce = idParts[2];
        
        //second name value pair: sauthc1SignedHeaders=*signedHeaders*
        var signedHeadersString = Optional.ofNullable(nameValuePairs[1])
                .map(function(nameValue){return nameValue.split('=');})
                .filter(function(nameValueArray){return nameValueArray.length === 2 && nameValueArray[0] === SAUTHC1_SIGNED_HEADERS;})
                .map(function(nameValueArray){return nameValueArray[1];})
                .orElseThrow(function(){return 'Invalid authorization signed headers: '+nameValuePairs[1];});

        //third name value pair: sauthc1Signature=*signature*
        var signatureHex = Optional.ofNullable(nameValuePairs[2])
                .map(function(nameValue){return nameValue.split('=');})
                .filter(function(nameValueArray){return nameValueArray.length === 2 && nameValueArray[0] === SAUTHC1_SIGNATURE;})
                .map(function(nameValueArray){return nameValueArray[1];})
                .orElseThrow(function(){return 'Invalid authorization signature: '+nameValuePairs[2];});

        return this.findUserAndSecret(apiKeyId)
                    .spread(function(user, secret){
                        return Optional.ofNullable(user)
                            .filter(function(){return signatureHex === computeSignature.call(this, req, signedHeadersString, apiKeyId, secret, dateStamp, nonce);}.bind(this))
                            .orElseThrow(function(){return 'digest verification failed';});
                    }.bind(this));
    }.bind(this))
    .then(this.success)
    .catch(this.fail);
};

 function computeSignature(req, signedHeadersString, apiKeyId, secret, dateStamp, nonce){
    var signedHeaders = signedHeadersString.split(';');
    var method = req.method;
    var canonicalResourcePath = encodeUrl(url.parse(Optional.ofNullable(this.rootUrl).orElse('')+req.originalUrl).pathname);
    var canonicalQueryString = req._parsedUrl.query ? encodeUrl(req._parsedUrl.query) : '';
    var canonicalHeadersString =
            _(req.headers)
                 .pick(signedHeaders)
                 .toPairs()
                 .sortBy(_.head)
                 .map(function(h){return h.join(':');})
                 .join('\n')+'\n';
    var requestPayloadHashHex = sha256(req.rawBody || '');
    var canonicalRequest = [method, canonicalResourcePath, canonicalQueryString, canonicalHeadersString, signedHeadersString, requestPayloadHashHex].join('\n');
    var canonicalRequestHashHex = sha256(new Buffer(canonicalRequest, 'utf-8'));
    var stringToSign = [ALGORITHM, req.headers[DATE_HEADER], apiKeyId+'/'+dateStamp+'/'+nonce+'/'+ID_TERMINATOR, canonicalRequestHashHex].join('\n');

    var kSecret = new Buffer(AUTHENTICATION_SCHEME + secret, 'utf-8');
    var kDate = hmac(kSecret, dateStamp);
    var kNonce = hmac(kDate, nonce);
    var kSigning = hmac(kNonce, ID_TERMINATOR);
    return hmac(kSigning, stringToSign, 'hex');
  }
  
  function hmac(key, buff, digest) {
    return crypto.createHmac('sha256', key).update(buff).digest(digest || 'binary');
  }
  
  function sha256(buff) {
    return crypto.createHash('sha256').update(buff).digest('hex');
  }
  
  function encodeUrl(path) {
    return path
      .replace(/\+/g, '%20')
      .replace(/\*/g, '%2A')
      .replace(/%7E/g, '~')
      .replace(/%2F/g, '/');
  }
  
module.exports = SAuthc1Strategy;