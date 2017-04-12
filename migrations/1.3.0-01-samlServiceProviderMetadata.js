"use strict";
module.exports = {
    up: function(migration, DataTypes) {
        return migration.createTable(
            'samlServiceProviderMetadata',
            {
                id: {
                    primaryKey: true,
                    type: DataTypes.UUID,
                    allowNull: false
                },
                privateKey: {
                    type: DataTypes.TEXT,
                    allowNull: false
                },
                x509SigningCert: {
                    type: DataTypes.TEXT,
                    allowNull: false
                },
                directoryId: {
                    type: DataTypes.UUID,
                    allowNull: false
                },
                createdAt: {
                    type: DataTypes.DATE,
                    allowNull: false
                },
                modifiedAt: {
                    type: DataTypes.DATE,
                    allowNull: false
                },
                tenantId:{
                    type: DataTypes.UUID,
                    allowNull: false,
                    references: {model: 'tenants'},
                    onDelete: 'cascade'
                }
            }
        );
    },

    down: function(migration) {
        return migration.dropTable("samlServiceProviderMetadata");
    }

};

