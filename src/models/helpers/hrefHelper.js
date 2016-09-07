"use strict";

var config = require('config');
var Optional = require('optional-js');

var hrefPattern = /^(.*?)\/v1\/(.*)$/;

//the root URL is only protocol + host
exports.getRootUrl = function(href){
    return href.replace(hrefPattern, '$1');
};

//the base URL also includes the protocol version (/v1/)
exports.baseUrl = Optional.ofNullable(config.get('server.rootUrl')).map(function(url){return url+'/v1/';}).orElse('/');

//unqualifyHref removes the base URL
exports.unqualifyHref = function(href){
    return href.replace(hrefPattern, '$2');
};


