"use strict";
module.exports = {
    up: function(migration, DataTypes) {
        return migration.createTable(
            'accountCreationPolicies',
            {
                id: {
                    primaryKey: true,
                    type: DataTypes.UUID,
                    allowNull: false
                },
                verificationEmailStatus: {
                    type: DataTypes.STRING(8),
                    allowNull: false,
                    defaultValue: 'DISABLED'
                },
                verificationSuccessEmailStatus: {
                    type: DataTypes.STRING(8),
                    allowNull: false,
                    defaultValue: 'DISABLED'
                },
                welcomeEmailStatus: {
                    type: DataTypes.STRING(8),
                    allowNull: false,
                    defaultValue: 'DISABLED'
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
                }
            }
        );
    },

    down: function(migration) {
        return migration.dropTable("passwordPolicies");
    }
};