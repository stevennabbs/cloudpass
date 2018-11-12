"use strict";

var models = require('../../models');
var ssacl = require('ssacl');

module.exports = function(apiKeyId, ...includes){
    return models.apiKey.findById(
        apiKeyId,
        {
            actor: new ssacl.Omnipotent(),
            include: [{
                model: models.account,
                attributes: [],
                include: [{
                        model: models.directory,
                        attributes: [],
                        where: {name: 'Cloudpass Administrators'}
                }]
            }].concat(includes)
        }
    );
};