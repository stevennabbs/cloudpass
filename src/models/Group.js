"use strict";

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

function createNewAccount(attributes, registrationWorflowEnabled){
    return this.getDirectory()
               .then(function(directory){
                   //create an account in the group's directory
                    return directory.createNewAccount(attributes, registrationWorflowEnabled);
               }).tap(function(account){
                   //add the account into this group
                    return this.addAccount(account, {tenantId: this.tenantId});
               }.bind(this));
}
