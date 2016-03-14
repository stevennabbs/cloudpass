"use strict";
module.exports = {
    up: function(migration, DataTypes) {
        return migration.createTable(
            'groupMemberships',
            {
                id: {
                    primaryKey: true,
                    type: DataTypes.UUID,
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
                accountId:{
                    type: DataTypes.UUID,
                    allowNull: false,
                    references: {model: "accounts"},
                    onDelete: "cascade"
                },
                groupId:{
                    type: DataTypes.UUID,
                    allowNull: false,
                    references: {model: "groups"},
                    onDelete: "cascade"
                }
            }
        );
    },

    down: function(migration) {
        return migration.dropTable("groupMemberships");
    }
};