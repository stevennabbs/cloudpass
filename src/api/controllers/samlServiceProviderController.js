"use strict";

var samlHelper = require('../helpers/samlHelper');
var models = require('../../models');
var ApiError = require('../../ApiError');

exports.get = function(req, res){
    // SAML service provider ID = application ID
    models.application
        .findById(req.swagger.params.id.value)
        .then(function(application){
            ApiError.assert(application, ApiError.NOT_FOUND);
            res.json(application.getSamlPolicy().getServiceProvider());
        })
        .catch(req.next);
};

exports.generateDefaultRelayState = function(req, res){
    samlHelper.getRelayState(
        req.app.get('secret'),
        req.user.id, //TODO req.user.id is not set after cookie authentication
        req.swagger.params.cb_uri.value,
        req.swagger.params.state.value,
        req.swagger.params.app_href.value
    )
    .then(function(relayState){
        res.json({defaultRelayState: relayState});
    });
};