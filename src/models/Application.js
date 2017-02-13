"use strict";

var _ = require('lodash');
var Optional = require('optional-js');
var accountStoreWrapperMethods = require('./helpers/accountStoreWrapperMethods');
var addAccountStoreAccessors = require('./helpers/addAccountStoreAccessors');
var hrefHelper = require('../helpers/hrefHelper');
var ApiError = require('../ApiError');

module.exports = function (sequelize, DataTypes) {
    return sequelize.define(
        'application',
        {
            id: {
                primaryKey: true,
                type: DataTypes.UUID,
                allowNull: false,
                defaultValue: DataTypes.UUIDV4
            },
            name: {
                type: DataTypes.STRING,
                validate: {len: [1, 255]},
                allowNull: false
            },
            description: {
                type: DataTypes.STRING(1022),
                validate: {len: [0, 1022]},
                defaultValue: ''
            },
            status:{
                type: DataTypes.STRING(8),
                validate: {isIn: [['ENABLED', 'DISABLED']]},
                allowNull: false,
                defaultValue: 'ENABLED'
            }
        },
        {
            indexes:[
                {
                    unique: true,
                    fields: ['name', 'tenantId']
                }
            ],
            getterMethods: {
                loginAttempts: function(){
                    return {href: this.href+'/loginAttempts'};
                },
                verificationEmails: function(){
                    return {href: this.href+'/verificationEmails'};
                },
                idSiteModel: function(){
                    return {href: this.href+'/idSiteModel'};
                },
                samlPolicy: function(){
                    return {href: hrefHelper.baseUrl+'samlPolicies/'+this.id};
                }
            },
            instanceMethods: _.assign(
                {
                    getSamlPolicy: function(){
                        var applicationHref = this.href;
                        return {
                            id: this.id,
                            href: hrefHelper.baseUrl+'samlPolicies/'+this.id,
                            createdAt: this.createdAt,
                            modifiedAt: this.createdAt,
                            serviceProvider: {href: hrefHelper.baseUrl+'samlServiceProviders/'+this.id},
                            getServiceProvider: function(){
                                return {
                                    id: this.id,
                                    href: hrefHelper.baseUrl+'samlServiceProviders/'+this.id,
                                    createdAt: this.createdAt,
                                    modifiedAt: this.createdAt,
                                    ssoInitiationEndpoint: {href: applicationHref+'/saml/sso/idpRedirect'},
                                    defaultRelayStates: {href: hrefHelper.baseUrl+'samlServiceProviders/'+this.id+'/defaultRelayStates'}
                                };
                            }
                        };
                    },
                    getLookupAccountStore: function(organizationName){
                        //if organizationName is specified, try to find an organization
                        //mapped to this application with that name.
                        //Else return this application
                        return Optional.ofNullable(organizationName)
                            .map(o => this.getOrganizations({
                                        attributes: ['id'],
                                        where: {name: o},
                                        limit: 1
                            })
                            .then(_.head)
                            .tap(_.partial(ApiError.assert, _, ApiError, 404, 2014, 'Organization %s is not linked to application', organizationName, this.id)))
                            .orElse(this.sequelize.Promise.resolve(this));
                    }
                },
                accountStoreWrapperMethods
            ),
            classMethods: {
                getSearchableAttributes: function(){
                    return ['id', 'name', 'description', 'status'];
                },
                getSettableAttributes: function(){
                    return ['name', 'description', 'status', 'customData'];
                },
                isCustomizable: function(){
                    return true;
                },
                associate: function (models) {
                    models.application.hasMany(models.accountStoreMapping, {onDelete: 'cascade'});
                    models.application.belongsTo(models.accountStoreMapping, {as: 'defaultAccountStoreMapping', constraints: false});
                    models.application.belongsTo(models.accountStoreMapping, {as: 'defaultGroupStoreMapping', constraints: false});
                    models.application.hasMany(models.passwordResetToken, {onDelete: 'cascade'});
                    models.application.belongsTo(models.tenant, {onDelete: 'cascade'});
                    models.application.belongsToMany(
                       models.organization, {
                           through:{
                               model: models.accountStoreMapping,
                               unique: false,
                               scope: {
                                   accountStoreType: 'organization'
                               }
                           },
                           foreignKey: 'applicationId'
                       }
                    );
                },
                afterAssociate: function(models){
                    addAccountStoreAccessors(models.application, models.account);
                    addAccountStoreAccessors(models.application, models.group);
                    addAccountStoreAccessors(models.application, models.directory);
                },
                getIdSiteScope: function(){
                    return [
                        'get',
                        { customData: [ 'get' ] },
                        { idSiteModel: [ 'get' ] },
                        { loginAttempts: [ 'post' ] },
                        { accounts: [ 'post' ] },
                        { passwordResetTokens: [ "post" ] },
                        { saml: {sso : {idpRedirect: ['get'] } } }
                    ];
                }
            }
        }
    );
};
