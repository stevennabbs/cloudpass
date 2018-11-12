"use strict";

const config = require('config');
const _ = require('lodash');
const models = require('../models/');
const Optional = require('optional-js');

const hrefPattern = /^((.*?)\/v1)(\/.*)$/;

const getHrefGroup = (groupId, defaultResult) =>
                        href =>  Optional.of(href)
                          .map(hrefPattern.exec.bind(hrefPattern))
                          .map(res => res[groupId])
                          .orElse(defaultResult);
//the root URL is only protocol + host
exports.getRootUrl = getHrefGroup(2, '');

//the base URL also includes the API version (/v1)
exports.getBaseUrl = getHrefGroup(1, '/v1');

//unqualifyHref removes the base URL
exports.unqualifyHref = href => href.replace(hrefPattern, '$3');

//returned the configured base URL
exports.baseUrl = Optional.ofNullable(config.get('server.rootUrl'))
                            .map(_.method('concat', '/v1/'))
                            .orElse('/');

exports.resolveHref = href => Optional.of(href)
        .map(exports.unqualifyHref)
        .map(_.method('split', '/'))
        .map(_.compact)
        .filter(_.matchesProperty('length', 2))
        .flatMap(hrefSplit =>
            Optional.ofNullable(_.find(_.values(models.sequelize.models), _.matchesProperty('options.name.plural', hrefSplit[0])))
                .map(_.method('build', {id: hrefSplit[1]}))
        ).orElse(null);

