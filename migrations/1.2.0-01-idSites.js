"use strict";
module.exports = {
    up: function(migration, DataTypes) {
        return migration.createTable(
            'idSites',
            {
                id: {
                    primaryKey: true,
                    type: DataTypes.UUID,
                    allowNull: false
                },
                url: {
                    type: DataTypes.STRING,
                    isUrl: true
                },
                logoUrl: {
                    type: DataTypes.STRING,
                    isUrl: true
                },
                sessionTtl: {
                    type: DataTypes.STRING(20),
                    allowNull: false,
                    defaultValue: 'PT30M'
                },
                sessionCookiePersistent: {
                    type: DataTypes.BOOLEAN,
                    allowNull: false,
                    defaultValue: true
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
        return migration.dropTable("idSites");
    }
    
};

