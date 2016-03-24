"use strict";

var accountStoreWrapperHelper = require('./helpers/accountStoreWrapperHelper');
var addAccountStoreAccessors = require('./helpers/addAccountStoreAccessors');

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
                }
            },
            instanceMethods: {
                createNewAccount: accountStoreWrapperHelper.createNewAccount,
                createNewGroup: accountStoreWrapperHelper.createNewGroup,
                getIdSiteModel: function(){
                    return this.sequelize.Promise.join(
                            [],
                            getDefaultPasswordStrengthPolicy(this),
                            getLogoUrl(this)
                    ).spread(function(providers, passwordPolicy, logoUrl){
                        return {
                            href: this.href+'/idSiteModel',
                            providers: providers,
                            passwordPolicy: passwordPolicy,
                            logoUrl: logoUrl
                        };
                    }.bind(this));
                }
            },
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
                }
            }
        }
    );
};

function getLogoUrl(application){
    return application.getTenant({
            attributes: [],
            include: [{
                    model: application.sequelize.models.idSite,
                    attributes: ['logoUrl']
                }]
        })
        .get('idSites')
        .get(0)
        .get('logoUrl');
}

function getDefaultPasswordStrengthPolicy(application){
    return getDefaultPasswordPolicy(application)
            .then(function(passwordPolicy){
                if(!passwordPolicy){
                    return null;
                }
                var passwordStrength = passwordPolicy.getStrength();
                return {
                    minLength: passwordStrength.minLength,
                    maxLength: passwordStrength.maxLength,
                    requireLowerCase: passwordStrength.minLowerCase > 0,
                    requireUpperCase: passwordStrength.minUpperCase > 0,
                    requireNumeric: passwordStrength.minNumeric > 0,
                    requireSymbol: passwordStrength.minSymbol > 0,
                    requireDiacritic: passwordStrength.minDiacritic > 0
                };
            });
}

//return the password strength policy applied in the default account store
function getDefaultPasswordPolicy(accountStoreWrapper){
    var models = accountStoreWrapper.sequelize.models;
    return accountStoreWrapper.getDefaultAccountStoreMapping()
            .then(function(asm){
                if(!asm){
                    return null;
                }
                switch(asm.accountStoreType){
                    case 'directory':
                        return asm
                                .getAccountStore({
                                    attributes: ['passwordPolicyId'],
                                    include: [models.passwordPolicy]
                                })
                                .get('passwordPolicy');
                    case 'group':
                        return asm
                                .getAccountStore({
                                    attributes: ['directoryId'],
                                    include: [{
                                        model: models.directory,
                                        attributes: ['passwordPolicyId'],
                                        include: [models.passwordPolicy]
                                    }]
                                })
                                .get('directory')
                                .get('passwordPolicy');
                    default: //organization
                        return asm
                                .getAccountStore({attributes: ['defaultAccountStoreMappingId']})
                                .then(getDefaultPasswordPolicy);
                }
            });
}
