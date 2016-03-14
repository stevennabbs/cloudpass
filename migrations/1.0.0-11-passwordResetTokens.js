"use strict";
module.exports = {
    up: function(migration, DataTypes) {
        return migration.createTable(
            'passwordResetTokens',
            {
                id: {
                    primaryKey: true,
                    type: DataTypes.UUID,
                    allowNull: false
                },
                email: {
                    type: DataTypes.STRING,
                    allowNull: false
                },
                expires: {
                    type: DataTypes.DATE,
                    allowNull: false
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
                },
                accountId:{
                    type: DataTypes.UUID,
                    allowNull: false,
                    references: {model: "accounts"},
                    onDelete: "cascade"
                }
            }
        );
    },

    down: function(migration, DataTypes) {
        return migration.dropTable("passwordResetTokens");
    }
};