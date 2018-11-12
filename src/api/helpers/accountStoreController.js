"use strict";

var _ = require('lodash');
var controllerHelper = require('../helpers/controllerHelper');
var baseController = require('../helpers/baseController');
var ApiError = require('../../ApiError');

//base controller enabling creating and querying accounts and groups
module.exports = function(model, transactionalMethods){

    var controller = baseController(model, transactionalMethods);

    controller.createAccount = function(req, res){
          controllerHelper.queryAndExpand(
            () => model.findById(req.swagger.params.id.value)
                .tap(ApiError.assertFound)
                .then(_.method(
                  'createNewAccount',
                  req.swagger.params.attributes.value,
                  req.swagger.params.registrationWorkflowEnabled.value,
                  req.authInfo, req.user
                )),
            req,
            res
          );
    };

    controller.createGroup = function(req, res){
          controllerHelper.queryAndExpand(
            () => model.findById(req.swagger.params.id.value)
                .tap(ApiError.assertFound)
                .then(_.method('createNewGroup', req.swagger.params.attributes.value)),
            req,
            res
          );
    };

    controller.getGroups = _.partial(controllerHelper.getCollection, model, 'groups');
    controller.getAccounts = _.partial(controllerHelper.getCollection, model, 'accounts');

    return controller;
};
