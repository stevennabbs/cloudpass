"use strict";

var _ = require('lodash');
var addAccountStoreAccessors = require('./helpers/addAccountStoreAccessors');
var sendEmail = require('../sendEmail');

module.exports = function (sequelize, DataTypes) {
    return sequelize.define(
        'directory',
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
            hooks: {
                beforeCreate: function(instance){
                    return instance.sequelize.Promise.join(
                        this.sequelize.models.passwordPolicy.create({tenantId: instance.tenantId}),
                        this.sequelize.models.accountCreationPolicy.create({tenantId: instance.tenantId})
                    )
                    .spread(function(passwordPolicy, accountCreationPolicy){
                        instance.set('passwordPolicyId', passwordPolicy.id);
                        instance.set('accountCreationPolicyId', accountCreationPolicy.id);
                    });
                },
                afterDestroy: function(instance){
                    return instance.sequelize.Promise.join(
                        this.sequelize.models.passwordPolicy.destroy({where: {id: instance.passwordPolicyId}}),
                        this.sequelize.models.accountCreationPolicy.destroy({where: {id: instance.accountCreationPolicyId}})
                    );
                }
            },
            instanceMethods:{
                createNewAccount: createNewAccount,
                createNewGroup: createNewGroup
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
                associate: function(models) {
                    models.directory.belongsTo(models.tenant, {onDelete: 'cascade'});
                    models.directory.belongsTo(models.passwordPolicy, {onDelete: 'cascade'});
                    models.directory.belongsTo(models.accountCreationPolicy, {onDelete: 'cascade'});
                    models.directory.hasMany(models.group, {onDelete: 'cascade'});
                    models.directory.hasMany(models.account, {onDelete: 'cascade'});
                    models.directory.hasMany(
                        models.accountStoreMapping,
                        {
                            as: 'applicationMappings',
                            foreignKey: 'accountStoreId',
                            constraints: false,
                            scope: {
                                accountStoreType: 'directory'
                            }
                        }
                    );
                    models.directory.hasMany(
                        models.organizationAccountStoreMapping,
                        {
                            as: 'organizationMappings',
                            foreignKey: 'accountStoreId',
                            constraints: false,
                            scope: {
                                accountStoreType: 'directory'
                            }
                        }
                    );
                    models.directory.belongsToMany(
                        models.organization, {
                            through:{
                                model: models.organizationAccountStoreMapping,
                                unique: false,
                                scope: {
                                    accountStoreType: 'directory'
                                }
                            },
                            foreignKey: 'accountStoreId',
                            constraints: false
                        }
                    );
                },
                afterAssociate: function(models){
                    addAccountStoreAccessors(models.directory, models.application);
                }
            }
        }
    );
};

function createNewAccount(attributes, registrationWorflowEnabled){
    var models = this.sequelize.models;
    
    //build the new account
    var account = models.account.build(
                _(attributes)
                    .pick(models.account.getSettableAttributes())
                    .defaults({directoryId: this.id, tenantId: this.tenantId})
                    .value());
            
    return this.getAccountCreationPolicy().then(function(accountCreationPolicy){
        return (
            //if necessary, generate an email verification token (and save the account in the same transaction)
            (registrationWorflowEnabled && accountCreationPolicy.verificationEmailStatus === 'ENABLED' && account.status !== 'DISABLED') ?
            this.sequelize.requireTransaction(function () {
                return models.emailVerificationToken
                    .create({tenantId: account.tenantId})
                    .then(function(token){
                        account.set({status: 'UNVERIFIED', emailVerificationTokenId: token.id});
                        return account.save();
                    });
            }):
            //else just save the account
            account.save()
        )
        .tap(function(account){
            if(account.emailVerificationTokenId){
                //asynchronously send an email with the verification token
                accountCreationPolicy
                    .getVerificationEmailTemplates({limit: 1})
                    .spread(function(template){
                        sendEmail(
                            account,
                            this,
                            template,
                            account.emailVerificationTokenId);
                    });
            } else if(account.status === 'ENABLED' && accountCreationPolicy.welcomeEmailStatus === 'ENABLED'){
                 //asynchronously send a welcome email
                accountCreationPolicy
                    .getWelcomeEmailTemplates({limit: 1})
                    .spread(function(template){
                        sendEmail(
                            account,
                            this,
                            template);
                    });
            }
        }.bind(this));
    }.bind(this));
}

function createNewGroup(attributes){
    return this.createGroup(
        _(attributes)
            .pick(this.sequelize.models.group.getSettableAttributes())
            .defaults({tenantId: this.tenantId})
            .value());
}