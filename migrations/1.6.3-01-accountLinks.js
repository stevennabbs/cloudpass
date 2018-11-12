"use strict";
module.exports = {
    up: function(migration, DataTypes, models) {
        return migration.createTable(
            'accountLinks',
            {
                id: {
                    primaryKey: true,
                    type: DataTypes.UUID,
                    allowNull: false
                },
                leftAccountId: {
                    type: DataTypes.UUID,
                    allowNull: false,
                    references: {model: "accounts"},
                    onDelete: "cascade"
                },
                rightAccountId: {
                    type: DataTypes.UUID,
                    allowNull: false,
                    references: {model: "accounts"},
                    onDelete: "cascade"
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
        .then(() => migration.addConstraint(
            'accountLinks',
            ['leftAccountId', 'rightAccountId'],
            {
              type: 'unique',
              name: 'accountLinks_leftAccountId_rightAccountId_uk'
            }
        ));
    },

    down: function(migration) {
        return migration.dropTable("accountLinks");
    }
};