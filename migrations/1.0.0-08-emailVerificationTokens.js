"use strict";
module.exports = {
    up: function(migration, DataTypes) {
        return migration.createTable(
            'emailVerificationTokens',
            {
                id: {
                    primaryKey: true,
                    type: DataTypes.UUID,
                    allowNull: false
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
        return migration.dropTable("emailVerificationTokens");
    }
};