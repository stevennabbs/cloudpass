"use strict";
module.exports = {
    up: function(migration, DataTypes) {
        return migration.createTable(
            'factors',
            {
                id: {
                    primaryKey: true,
                    type: DataTypes.UUID,
                    allowNull: false
                },
                type: {
                    type: DataTypes.STRING(30),
                    allowNull: false
                },
                status:{
                    type: DataTypes.STRING(8),
                    allowNull: false,
                    defaultValue: 'ENABLED'
                },
                verificationStatus: {
                    type: DataTypes.STRING(10),
                    allowNull: false,
                    defaultValue: 'UNVERIFIED'
                },
                accountName: {
                    type: DataTypes.STRING
                },
                issuer: {
                    type: DataTypes.STRING(255)
                },
                secret: {
                    type: DataTypes.STRING(32)
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
                }
            }
        )
        .then(function(){
            return migration.addIndex(
                'factors',
                ['tenantId', 'accountId']
            );
        });
    },

    down: function(migration) {
        return migration.dropTable("groups");
    }
};