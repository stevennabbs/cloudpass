"use strict";
module.exports = {
    up: function(migration, DataTypes) {
        return migration.createTable(
            'attributeStatementMappingRules',
            {
                id: {
                    primaryKey: true,
                    type: DataTypes.UUID,
                    allowNull: false
                },
                items: {
                    type: DataTypes.JSON,
                    defaultValue: [],
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
        return migration.dropTable("attributeStatementMappingRules");
    }

};

