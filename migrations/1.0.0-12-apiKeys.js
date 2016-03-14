"use strict";
module.exports = {
    up: function(migration, DataTypes) {
        return migration.createTable(
            'apiKeys',
            {
                id: {
                    primaryKey: true,
                    type: DataTypes.UUID,
                    allowNull: false
                },
                secret: {
                    type: DataTypes.STRING(50),
                    allowNull: false
                },
                status:{
                    type: DataTypes.STRING(8),
                    allowNull: false,
                    defaultValue: 'ENABLED'
                },
                tenantId:{
                    type: DataTypes.UUID,
                    allowNull: false,
                    references: {model: "tenants"},
                    onDelete: "cascade"
                },
                accountId:{
                    type: DataTypes.UUID,
                    allowNull: false,
                    references: {model: "accounts"},
                    onDelete: "cascade"
                },
                createdAt: {
                    allowNull: false,
                    type: DataTypes.DATE
                },
                modifiedAt: {
                    allowNull: false,
                    type: DataTypes.DATE
                }
            }
        );
    },
    down: function(migration) {
        return migration.dropTable("apiKeys");
    }
};