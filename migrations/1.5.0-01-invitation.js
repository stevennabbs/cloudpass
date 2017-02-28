"use strict";

module.exports = {
    up: function(migration, DataTypes, models) {
        return migration.createTable(
            'invitations',
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
                callbackUri: {
                    type: DataTypes.STRING,
                    allowNull: true,
                },
                customData: {
                    type: DataTypes.STRING(10485760),
                    defaultValue: "{}",
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
                fromAccountId:{
                    type: DataTypes.UUID,
                    references: {model: "accounts"},
                    allowNull: true,
                    onDelete: "cascade",
                },
                applicationId:{
                    type: DataTypes.UUID,
                    references: {model: "applications"},
                    allowNull: false,
                    onDelete: "cascade"
                },
                organizationId:{
                    type: DataTypes.UUID,
                    references: {model: "organizations"},
                    allowNull: true,
                    onDelete: "cascade"
                },
                tenantId:{
                    type: DataTypes.UUID,
                    allowNull: false,
                    references: {model: "tenants"},
                    onDelete: "cascade"
                }
            }
        )
        .then(function(){
            return migration.addIndex(
                'invitations',
                ['tenantId', 'organizationId']
            );
        });
    },

    down: function(migration) {
        return migration.dropTable("invitations");
    }
};