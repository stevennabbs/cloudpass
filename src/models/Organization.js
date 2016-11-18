"use strict";

var accountStoreWrapperMethods = require('./helpers/accountStoreWrapperMethods');
var addAccountStoreAccessors = require('./helpers/addAccountStoreAccessors');

module.exports = function (sequelize, DataTypes) {
    return sequelize.define(
        'organization',
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
                defaultValue: ''
            },
            nameKey: {
                type: DataTypes.STRING,
                validate: {len: [0, 63]}
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
              idSiteModel: function(){
                    return {href: this.href+'/idSiteModel'};
              }
            },
            instanceMethods: accountStoreWrapperMethods,
            classMethods: {
                getSearchableAttributes: function(){
                    return ['id', 'name', 'nameKey', 'description', 'status'];
                },
                getSettableAttributes: function(){
                    return ['name', 'nameKey', 'description', 'status', 'customData'];
                },
                isCustomizable: function(){
                    return true;
                },
                associate: function(models) {
                    models.organization.belongsTo(models.tenant, {onDelete: 'cascade'});
                    models.organization.hasMany(models.organizationAccountStoreMapping, {as: 'accountStoreMappings', onDelete: 'cascade'});
                    models.organization.belongsTo(models.organizationAccountStoreMapping, {as: 'defaultAccountStoreMapping', constraints: false});
                    models.organization.belongsTo(models.organizationAccountStoreMapping, {as: 'defaultGroupStoreMapping', constraints: false});
                    models.organization.belongsToMany(
                       models.directory, {
                           through:{
                               model: models.organizationAccountStoreMapping,
                               unique: false,
                               scope: {
                                   accountStoreType: 'directory'
                               }
                           },
                           foreignKey: 'organizationId',
                           constraints: false
                       }
                    );
                    models.organization.hasMany(
                        models.accountStoreMapping,
                        {
                            as: 'applicationMappings',
                            foreignKey: 'accountStoreId',
                            constraints: false,
                            scope: {
                                accountStoreType: 'organization'
                            }
                        }
                    );
                    models.organization.belongsToMany(
                        models.application, {
                            through:{
                                model: models.accountStoreMapping,
                                unique: false,
                                scope: {
                                    accountStoreType: 'organization'
                                }
                            },
                            foreignKey: 'accountStoreId',
                            constraints: false
                        }
                    );
                },
                afterAssociate: function(models){
                    addAccountStoreAccessors(models.organization, models.account);
                    addAccountStoreAccessors(models.organization, models.group);
                },
                getIdSiteScope: function(){
                    return [
                        "get",
                        { idSiteModel: [ "get" ] },
                        { accounts: [ "post" ] }
                    ];
                }
            }
        }
    );
};
