"use strict";

var shimmer = require('shimmer');
var _ = require('lodash');
var baseController = require('../helpers/baseController');
var samlHelper = require('../helpers/samlHelper');
var models = require('../../models');
var ApiError = require('../../ApiError');

var controller = baseController(models.samlServiceProviderMetadata);

shimmer.wrap(controller, 'get', function (original) {
    //send regular JSON object or the metadata in SAML XML format
    //depending on the accepted content types
    return function (req, res) {
        res.format({
            json: _.partial(original, req, res),
            xml: _.partial(sendXmlMetadata, req, res),
            'default': _.partial(sendXmlMetadata, req, res)
        });
    };
});

function sendXmlMetadata(req, res){
    models.samlServiceProviderMetadata
        .findById(req.swagger.params.id.value)
        .tap(_.partial(ApiError.assert, _, ApiError.NOT_FOUND))
        .then(function(providerMetadata){
            res.type('xml').send(samlHelper.getXmlMetadata(providerMetadata));
        });
}

module.exports = controller;