"use strict";
module.exports = {
    up: function(migration, DataTypes) {
        return migration.createTable(
            'accountStoreMappings',
            {
                id: {
                    primaryKey: true,
                    type: DataTypes.UUID,
                    allowNull: false
                },
                accountStoreId: {
                    type: DataTypes.UUID,
                    validate: {isUUID: 4},
                    allowNull: false
                },
                accountStoreType: {
                    type: DataTypes.ENUM('directory', 'group', 'organization'),
                    allowNull: false
                },
                listIndex: {
                    type: DataTypes.INTEGER,
                    allowNull: false
                },
                isDefaultAccountStore: {
                    type: DataTypes.BOOLEAN,
                    allowNull: false,
                    defaultValue: false
                },
                isDefaultGroupStore: {
                    type: DataTypes.BOOLEAN,
                    allowNull: false,
                    defaultValue: false
                },
                createdAt: {
                    allowNull: false,
                    type: DataTypes.DATE
                },
                modifiedAt: {
                    allowNull: false,
                    type: DataTypes.DATE
                },
                tenantId:{
                    type: DataTypes.UUID,
                    allowNull: false,
                    references: {model: "tenants"},
                    onDelete: "cascade"
                },
                applicationId:{
                    type: DataTypes.UUID,
                    allowNull: false,
                    references: {model: "applications"},
                    onDelete: "cascade"
                }
            }
        )
        .then(function(){
            return migration.addIndex(
                'accountStoreMappings',
                ['accountStoreId', 'accountStoreType', 'applicationId'],
                {indicesType: 'UNIQUE'}
            );
        });
    },

    down: function(migration, DataTypes) {
        return migration.dropTable("accountStoreMappings");
    }
};