"use strict";

const _ = require('lodash');
const BluebirdPromise = require('sequelize').Promise;
const signJwt = BluebirdPromise.promisify(require('jsonwebtoken').sign);
const accountStoreController = require('../helpers/accountStoreController');
const controllerHelper = require('../helpers/controllerHelper');
const samlHelper = require('../helpers/samlHelper');
const models = require('../../models');
const sendJwtResponse = require('../../apps/helpers/sendJwtResponse');
const ApiError = require('../../ApiError');
const hrefHelper = require('../../helpers/hrefHelper');


var controller = accountStoreController(models.directory, ['create', 'delete']);

controller.create = function(req, res){
    var attributes = req.swagger.params.attributes.value;
    controllerHelper.queryAndExpand(
      () => controllerHelper.create(
                models.directory,
                {tenantId: req.user.tenantId},
                attributes,
                true
            )
            .tap(function(newDirectory){
                //'cloudpass' provider doesn't require storing additional data
                if(attributes.provider && attributes.provider.providerId !== 'cloudpass'){
                    return controllerHelper.create(
                        models.directoryProvider,
                        {
                            tenantId: req.user.tenantId,
                            directoryId: newDirectory.id,
                            providerId: attributes.provider.providerId
                        },
                        attributes.provider,
                        true
                    );
                }
            }),
      req,
      res,
      true
    );
};

controller.getProvider = _.partial(controller.getSubResource, 'getProvider');

controller.updateProvider = function(req, res) {
    controllerHelper.queryAndExpand(
      () => models.directory.build({id: req.swagger.params.id.value, tenantId: req.user.tenantId})
                .getProvider()
                .tap(provider => {
                    //'cloudpass' provider is not persited in database and cannot be updated
                    if(provider.providerId !== 'cloudpass'){
                        return provider.update(
                            req.swagger.params.newAttributes.value,
                            //the providerId cannot be changed
                            {fields: _.without(models.directoryProvider.settableAttributes, 'providerId')}
                        );
                    }
                }),
      req,
      res
    );
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
        return models.sequelize.requireTransaction(function () {
           return models.account.findOrCreate({
                where:{
                    email: _.toLower(samlResponse.user.name_id),
                    directoryId: req.swagger.params.id.value
                },
                defaults:{
                    tenantId: req.user.tenantId,
                    //disable password authentication by default for SAML accounts
                    passwordAuthenticationAllowed: false
                }
           })
           .spread(function(account, created){
               var providerData = _.defaults({providerId: 'saml'}, _.mapValues(samlResponse.user.attributes, _.head));
                return BluebirdPromise.join(
                    account.update(
                    //'_.fromPairs' doesn't support property paths (customData.xxx), so we use zipObjectDeep(zip) instead
                      _.spread(_.zipObjectDeep)(_.spread(_.zip)(
                        _(mappingRules.items)
                           //get account attribute lists and their new value
                           .map(_.over(_.property('accountAttributes'), _.flow(_.property('name'), _.propertyOf(providerData))))
                           //make pairs of account attribute/value (obviously)
                           .flatMap(_.spread(_.overArgs(_.map, [_.identity, _.flow(_.constant, _.partial(_.over, _.identity))])))
                            //add provider data
                           .tap(_.method('push', ['providerData', providerData]))
                           .value()
                      ))
                    ),
                    created
              );
           });
        });
    })
    //check that the account belongs to the required organization
    .tap(res =>
        hrefHelper.resolveHref(req.authInfo.app_href)
                .getLookupAccountStore(req.authInfo.onk)
                .then(as => as.getAccounts({
                    where: {id: res[0].id},
                    limit:1,
                    attributes: ['id']
                }))
                .get(0)
                .then(_.partial(ApiError.assert, _, ApiError, 400, 7104, 'This account does not belong to the required account store'))
    )
    .spread(function(account, created){
        return signJwt(
            {
                isNewSub: created,
                status: "AUTHENTICATED",
                cb_uri: req.authInfo.cb_uri,
                irt: req.authInfo.init_jti,
                state: req.authInfo.state,
                inv_href: req.authInfo.inv_href
            },
            req.user.secret,
            {
                expiresIn: 60,
                issuer: req.authInfo.app_href,
                subject: account.href,
                audience: req.user.id,
                header: {
                    kid: req.user.id,
                    stt: 'assertion'
                }
            }
        );
    })
    .then(sendJwtResponse(res, req.authInfo.cb_uri))
    .catch(req.next);
};

module.exports = controller;