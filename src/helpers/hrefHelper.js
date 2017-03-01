"use strict";

var config = require('config');
var _ = require('lodash');
var Optional = require('optional-js');

var hrefPattern = /^((.*?)\/v1)(\/.*)$/;

const getHrefGroup = (groupId, defaultResult) =>
                        href =>  Optional.of(href)
                          .map(hrefPattern.exec.bind(hrefPattern))
                          .map(res => res[groupId])
                          .orElse(defaultResult);
//the root URL is only protocol + host
exports.getRootUrl = getHrefGroup(2, '');

//the base URL also includes the protocol version (/v1)
exports.getBaseUrl = getHrefGroup(1, '/v1');

//unqualifyHref removes the base URL
exports.unqualifyHref = href => href.replace(hrefPattern, '$3');

//returned the configured base URL
exports.baseUrl = Optional.ofNullable(config.get('server.rootUrl'))
                            .map(_.method('concat', '/v1/'))
                            .orElse('/');