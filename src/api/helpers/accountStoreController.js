"use strict";

var _ = require('lodash');
var controllerHelper = require('../helpers/controllerHelper');
var baseController = require('../helpers/baseController');

//base controller enabling creating and querying accounts and groups
module.exports = function(model, transactionalMethods){
    
    var controller = baseController(model, transactionalMethods);

    controller.createAccount = function(req, res){
          model.findById(req.swagger.params.id.value)
                .then(_.method('createNewAccount', req.swagger.params.attributes.value, req.swagger.params.registrationWorkflowEnabled.value))
                .then(_.partial(controllerHelper.expand, _, req))
                .then(res.json.bind(res))
                .catch(req.next);
    };

    controller.createGroup = function(req, res){
          model.findById(req.swagger.params.id.value)
                .then(_.method('createNewGroup', req.swagger.params.attributes.value))
                .then(_.partial(controllerHelper.expand, _, req))
                .then(res.json.bind(res))
                .catch(req.next);
    };

    controller.getGroups = _.partial(controllerHelper.getCollection, model, 'groups');
    controller.getAccounts = _.partial(controllerHelper.getCollection, model, 'accounts');
    
    return controller;
};
