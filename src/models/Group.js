"use strict";

var _ = require('lodash');
var addAccountStoreAccessors = require('./helpers/addAccountStoreAccessors');

module.exports = function (sequelize, DataTypes) {
    return sequelize.define(
            'group',
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
                    type: DataTypes.TEXT,
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
                indexes: [
                    {
                        unique: true,
                        fields: ['name', 'directoryId', 'tenantId']
                    }
                ],
                instanceMethods:{
                    createNewAccount: createNewAccount
                },
                classMethods: {
                    getSearchableAttributes: _.constant(['id', 'name', 'description', 'status']),
                    getSettableAttributes:  _.constant(['name', 'description', 'status', 'customData']),
                    isCustomizable: _.stubTrue,
                    associate: function(models) {
                        models.group.belongsTo(models.tenant, {onDelete: 'cascade'});
                        models.group.belongsTo(models.directory, {onDelete: 'cascade'});
                        models.group.hasMany(models.groupMembership, {as: 'accountMemberships', onDelete: 'cascade'});
                        models.group.belongsToMany(
                            models.account,
                            {
                                through: models.groupMembership,
                                onDelete: 'cascade'
                            }
                        );
                        models.group.hasMany(
                            models.accountStoreMapping,
                            {
                                as: 'applicationMappings',
                                foreignKey: 'accountStoreId',
                                constraints: false,
                                scope: {
                                    accountStoreType: 'group'
                                }
                            }
                        );
                        models.group.hasMany(
                            models.organizationAccountStoreMapping,
                            {
                                as: 'organizationMappings',
                                foreignKey: 'accountStoreId',
                                constraints: false,
                                scope: {
                                    accountStoreType: 'group'
                                }
                            }
                        );
                        models.group.belongsToMany(
                            models.organization, {
                                through:{
                                    model: models.organizationAccountStoreMapping,
                                    unique: false,
                                    scope: {
                                        accountStoreType: 'group'
                                    }
                                },
                                foreignKey: 'accountStoreId',
                                constraints: false
                            }
                        );
                    },
                    afterAssociate: function(models){
                        addAccountStoreAccessors(models.group, models.application);
                    }
                }
            }
    );
};

function createNewAccount(attributes, registrationWorflowEnabled, authInfo, apiKey){
    return this.getDirectory()
             //create an account in the group's directory
            .then(_.method('createNewAccount', attributes, registrationWorflowEnabled, authInfo, apiKey))
             //add the account in the group
            .tap(account => this.addAccount(account, {tenantId: this.tenantId}));
}
