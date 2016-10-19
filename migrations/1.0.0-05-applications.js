"use strict";
module.exports = {
    up: function(migration, DataTypes) {
        return migration.createTable(
            'applications',
            {
                id: {
                    primaryKey: true,
                    type: DataTypes.UUID,
                    allowNull: false
                },
                name: {
                    type: DataTypes.STRING,
                    allowNull: false
                },
                description: {
                    type: DataTypes.STRING(1022),
                    defaultValue: ''
                },
                status:{
                    type: DataTypes.STRING(8),
                    allowNull: false,
                    defaultValue: 'ENABLED'
                },
                defaultAccountStoreMappingId: {
                    type: DataTypes.UUID
                },
                defaultGroupStoreMappingId: {
                    type: DataTypes.UUID
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
                'applications',
                ['name', 'tenantId'],
                {indicesType: 'UNIQUE'}
            );
        });
    },

    down: function(migration) {
        return migration.dropTable("applications");
    }
};