"use strict";

var models = require('../../models');
var ssacl = require('ssacl');

module.exports = function(apiKeyId, includes){
    includes = includes || [];
    includes.push({
        model: models.account,
        attributes: [],
        include: [{
                model: models.directory,
                attributes: [],
                where: {name: 'Cloudpass Administrators'}
        }]
    });
    return models.apiKey.findById(
        apiKeyId,
        {
            actor: new ssacl.Omnipotent(),
            include: includes
        }
    );
};