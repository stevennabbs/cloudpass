"use strict";
module.exports = {
    up: function(migration, DataTypes) {
        return migration.createTable(
            'tenants',
            {
                id: {
                    primaryKey: true,
                    type: DataTypes.UUID,
                    allowNull: false
                },
                key: {
                    type: DataTypes.STRING(63),
                    unique: true,
                    allowNull: false
                },
                name: {
                    type: DataTypes.STRING,
                    allowNull: false
                },
                customData: {
                    type: DataTypes.TEXT,
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
                }
            }
        )
        .then(function(){
            return migration.addIndex(
                'tenants',
                ['name'],
                {indicesType: 'UNIQUE'}
            );
        })
        .then(function(){
            return migration.addIndex(
                'tenants',
                ['key'],
                {indicesType: 'UNIQUE'}
            );
        });
    },

    down: function(migration) {
        return migration.dropTable("tenants");
    }
};