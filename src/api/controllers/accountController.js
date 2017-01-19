"use strict";

var _ = require('lodash');
var BluebirdPromise = require('sequelize').Promise;
var Optional = require('optional-js');
var controllerHelper = require('../helpers/controllerHelper');
var baseController = require('../helpers/baseController');
var models = require('../../models');
var ApiError = require('../../ApiError');
var email = require('../../helpers/email');

var controller = baseController(models.account);

controller.getCurrent = function (req, res) {
    res.status(302).location(req.user.accountId).json();
};

controller.getApiKeys = _.partial(controllerHelper.getCollection, models.account, 'apiKeys');
controller.createApiKey = function(req, res){
    return controllerHelper.createAndExpand(
            models.apiKey,
            {tenantId: req.user.tenantId, accountId: req.swagger.params.id.value},
            req, res);
};

controller.getFactors = _.partial(controllerHelper.getCollection, models.account, 'factors');
controller.createFactor = function(req, res){
    var accountId = req.swagger.params.id.value;
    var factorAttributes = req.swagger.params.attributes.value;
    //if accountName is not set, take the account email
    BluebirdPromise.resolve(
      Optional.ofNullable(factorAttributes.accountName)
        .orElseGet(() => models.account.findById(accountId, {attributes: ['email']})
                        .tap(ApiError.assertFound)
                        .get('email'))
    ).then(email => {
        factorAttributes.accountName = email;
        return controllerHelper.createAndExpand(
            models.factor,
            {tenantId: req.user.tenantId, accountId: accountId},
            req, res);
    });
};

controller.consumeEmailVerificationToken = function(req, res){
    models.sequelize.transaction(function(){
        //account creation policy cannot be eagerly loaded here
        //see https://github.com/sequelize/sequelize/issues/2084
        return models.emailVerificationToken.findById(
            req.swagger.params.tokenId.value,
            {
                include: [{
                    model: models.account,
                    include: [{
                        model: models.directory
                    }]
                }]
            }
        )
        .then(function(token){
            ApiError.assert(token, ApiError.NOT_FOUND);
            //enable the account and delete the token
            return models.sequelize.Promise.join(
                        token.account.update({status: 'ENABLED'}),
                        token.destroy()
                    );
        });
    })
    .spread(function(account){
        account.directory.getAccountCreationPolicy()
                .then(function(policy){
                    //send verification success & welcome emails if they are enabled
                    if(policy.verificationSuccessEmailStatus === 'ENABLED'){
                        policy
                            .getVerificationSuccessEmailTemplates({limit: 1})
                            .spread(function(template){
                                email.send(
                                    account,
                                    account.directory,
                                    template);
                            });
                    }
                    if(policy.welcomeEmailStatus === 'ENABLED'){
                        policy
                            .getWelcomeEmailTemplates({limit : 1})
                            .spread(function(template){
                                email.send(
                                    account,
                                    account.directory,
                                    template);
                            });
                    }
                });

        //send the whole account only if the expand parameter is set
        res.json(req.swagger.params.expand.value?account:_.pick(account, 'href'));
    })
    .catch(req.next);
};

controller.getProviderData = _.partial(controller.getComputedSubResource, 'getProviderData');

module.exports = controller;