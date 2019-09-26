"use strict";

const _ = require('lodash');
const controllerHelper = require('../helpers/controllerHelper');
const baseController = require('../helpers/baseController');
const ApiError = require('../../ApiError');

//base controller enabling creating and querying accounts and groups
module.exports = function (model, transactionalMethods) {

    const controller = baseController(model, transactionalMethods);

    controller.createAccount = function (req, res) {

        // verify honeypot anti-spam fields
        const spam = (req.body.first_name || req.body.last_name || req.body.email_address || req.body.company_name
            || req.body.user_password || req.body.confirm_password);
        ApiError.assert(!spam, ApiError, 400, 400, 'Spam detected');

        controllerHelper.queryAndExpand(
            () => model.findByPk(req.swagger.params.id.value)
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

    controller.createGroup = function (req, res) {
        controllerHelper.queryAndExpand(
            () => model.findByPk(req.swagger.params.id.value)
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
