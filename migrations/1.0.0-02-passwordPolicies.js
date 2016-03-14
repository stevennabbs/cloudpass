"use strict";
module.exports = {
    up: function(migration, DataTypes) {
        return migration.createTable(
            'passwordPolicies',
            {
                id: {
                    primaryKey: true,
                    type: DataTypes.UUID,
                    allowNull: false
                },
                resetEmailStatus: {
                    type: DataTypes.STRING(8),
                    allowNull: false,
                    defaultValue: 'DISABLED'
                },
                resetSuccessEmailStatus: {
                    type: DataTypes.STRING(8),
                    allowNull: false,
                    defaultValue: 'DISABLED'
                },
                resetTokenTtl: {
                    type: DataTypes.INTEGER,
                     defaultValue: 24
                },
                maxLength: {
                    type: DataTypes.INTEGER,
                    defaultValue: 100
                },
                minLength: {
                    type: DataTypes.INTEGER,
                    defaultValue: 8
                },
                minLowerCase: {
                    type: DataTypes.INTEGER,
                    defaultValue: 1
                },
                minNumeric: {
                    type: DataTypes.INTEGER,
                    defaultValue: 1
                },
                minSymbol: {
                    type: DataTypes.INTEGER,
                    defaultValue: 0
                },
                minUpperCase: {
                    type: DataTypes.INTEGER,
                    defaultValue: 1
                },
                minDiacritic: {
                    type: DataTypes.INTEGER,
                    defaultValue: 0
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