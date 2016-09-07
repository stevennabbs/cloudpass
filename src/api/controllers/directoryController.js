"use strict";

var _ = require('lodash');
var BluebirdPromise = require('sequelize').Promise;
var accountStoreController = require('../helpers/accountStoreController');
var controllerHelper = require('../helpers/controllerHelper');
var samlHelper = require('../helpers/samlHelper');
var getJwtResponse = require('../../apps/helpers/idSiteHelper').getJwtResponse;
var models = require('../../models');


var controller = accountStoreController(models.directory, ['create', 'delete']);

controller.create = function(req, res){
    var attributes = req.swagger.params.attributes.value;
    return models.sequelize.requireTransaction(function(){
        return controllerHelper.create(
                models.directory,
                {tenantId: req.user.tenantId},
                attributes,
                true
            )
            .tap(function(newDirectory){
                //'cloudpass' provider don't require storing additional data
                if(attributes.provider && attributes.provider.providerId !== 'cloudpass'){
                    return controllerHelper.create(
                        models.directoryProvider,
                        {tenantId: req.user.tenantId, directoryId: newDirectory.id},
                        attributes.provider,
                        true
                    );
                }
            });
        })
        .then(_.partial(controllerHelper.expand, _, req))
        .then(res.json.bind(res))
        .catch(req.next);
};

controller.getProvider = function(req, res){
    models.directory.build({id: req.swagger.params.id.value, tenantId: req.user.tenantId})
            .getProvider()
            .then(_.partial(controllerHelper.expand, _, req))
            .then(res.json.bind(res))
            .catch(req.next);
};

controller.updateProvider = function(req, res) {
    models.directory.build({id: req.swagger.params.id.value, tenantId: req.user.tenantId})
            .getProvider()
            .tap(function(provider){
                //'cloudpass' provider is not persited in database and cannot be updated
                if(provider.providerId !== 'cloudpass'){
                    return provider.update(
                        req.swagger.params.newAttributes.value,
                        //the providerId cannot be changed
                        {fields:  _.without(models.directoryProvider.getSettableAttributes(), 'providerId')}
                    );
                }
            })
            .then(_.partial(controllerHelper.expand, _, req))
            .then(res.json.bind(res))
            .catch(req.next);
};

controller.consumeSamlAssertion = function(req, res){
    models.directoryProvider.findOne({
        where: {directoryId: req.swagger.params.id.value},
        include: [models.samlServiceProviderMetadata, models.attributeStatementMappingRules]
    })
    .then(function(provider){
        return BluebirdPromise.join(
            samlHelper.getSamlResponse(provider, req.body),
            provider.attributeStatementMappingRules
        );
    })
    .spread(function(samlResponse, mappingRules){
        return models.sequelize.requireTransaction(function (t) {
           return models.account.findOrCreate({
                where:{
                    email: samlResponse.user.name_id,
                    directoryId: req.swagger.params.id.value
                },
                defaults:{
                    tenantId: req.user.tenantId
                },
                transaction: t
           })
           .spread(function(account, created){
                return BluebirdPromise.join(
                    account.update(
                     _(mappingRules.items)
                        //get account attribute lists and their new value
                        .map(_.over(_.property('accountAttributes'), _.flow(_.property('name'), _.propertyOf(samlResponse.user.attributes), _.head)))
                        //make pairs of account attribute/value (obviously)
                        .flatMap(_.spread(_.overArgs(_.map, [_.identity, _.flow(_.constant, _.partial(_.over, _.identity))])))
                        .fromPairs()
                        .value(),
                     {transaction: t}
                    ),
                    created
              );
           });
        });
    })
    .spread(function(account, created){
        return getJwtResponse(req.user, req.authInfo.cb_uri, req.authInfo.init_jti, created, account.href, req.authInfo.state, req.authInfo.app_href);
    })
    .then(function(jwtResponse){
        res.redirect('../../../../../sso?jwtResponse='+jwtResponse);
    })
    .catch(function(){
        res.redirect(req.authInfo.cb_uri);
    });
};

module.exports = controller;