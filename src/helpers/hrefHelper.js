"use strict";

var config = require('config');
var Optional = require('optional-js');

var hrefPattern = /^((.*?)\/v1)(\/.*)$/;

//the root URL is only protocol + host
exports.getRootUrl =  href => href.replace(hrefPattern, '$2');

//the base URL also includes the protocol version (/v1/)
exports.getBaseUrl = href => href.replace(hrefPattern, '$1');

//unqualifyHref removes the base URL
exports.unqualifyHref = href => href.replace(hrefPattern, '$3');

//returned the configured base URL
exports.baseUrl = Optional.ofNullable(config.get('server.rootUrl')).map(function(url){return url+'/v1/';}).orElse('/');