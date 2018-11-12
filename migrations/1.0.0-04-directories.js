"use strict";
module.exports = {
    up: function(migration, DataTypes) {
        return migration.createTable(
            'directories',
            {
                id: {
                    primaryKey: true,
                    type: DataTypes.UUID,
                    allowNull: false
                },
                name: {
                    type: DataTypes.STRING,
                    allowNull: false
                },
                description: {
                    type: DataTypes.TEXT,
                    defaultValue: ''
                },
                status:{
                    type: DataTypes.STRING(8),
                    allowNull: false,
                    defaultValue: 'ENABLED'
                },
                customData: {
                    type: DataTypes.JSON,
                    defaultValue: {},
                    allowNull: false
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
                passwordPolicyId:{
                    type: DataTypes.UUID,
                    allowNull: false,
                    references: {model: "passwordPolicies"},
                    onDelete: "cascade"
                },
                accountCreationPolicyId:{
                    type: DataTypes.UUID,
                    allowNull: false,
                    references: {model: "accountCreationPolicies"},
                    onDelete: "cascade"
                }
            }
        )
        .then(function(){
            return migration.addIndex(
                'directories',
                ['name', 'tenantId'],
                {indicesType: 'UNIQUE'}
            );
        });
    },

    down: function(migration) {
        return migration.dropTable("directories");
    }
};