"use strict";
module.exports = {
    up: function(migration, DataTypes) {
        return migration.createTable(
            'directoryProviders',
            {
                id: {
                    primaryKey: true,
                    type: DataTypes.UUID,
                    allowNull: false
                },
                providerId: {   
                    type: DataTypes.STRING(9),
                    allowNull: false,
                    defaultValue: 'cloudpass'
                },
                clientId:{
                    type: DataTypes.STRING,
                    allowNull: true
                },
                clientSecret: {
                    type: DataTypes.STRING,
                    allowNull: true
                },
                ssoLoginUrl: {
                    type: DataTypes.STRING,
                    allowNull: true
                },
                ssoLogoutUrl: {
                    type: DataTypes.STRING,
                    allowNull: true
                },
                encodedX509SigningCert: {
                    type: DataTypes.STRING(2000),
                    allowNull: true
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
                directoryId:{
                    type: DataTypes.UUID,
                    allowNull: false,
                    references: {model: "directories"},
                    onDelete: "cascade"
                },
                attributeStatementMappingRulesId:{
                    type: DataTypes.UUID,
                    allowNull: false,
                    references: {model: "attributeStatementMappingRules"},
                    onDelete: "cascade"
                },
                samlServiceProviderMetadataId:{
                    type: DataTypes.UUID,
                    allowNull: false,
                    references: {model: "samlServiceProviderMetadata"},
                    onDelete: "cascade"
                }
            }
        );        
    },
    
    down: function(migration) {
        return migration.dropTable("directoryProviders");
    }
    
};

