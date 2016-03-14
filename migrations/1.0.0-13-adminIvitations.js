"use strict";
module.exports = {
    up: function(migration, DataTypes) {
      return migration.createTable(
            'adminInvitations',
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
                fromAccountId:{
                    type: DataTypes.UUID,
                    allowNull: false,
                    references: {model: "accounts"},
                    onDelete: "cascade"
                }
            }
        );
    },

    down: function(migration) {
        return migration.dropTable("adminInvitations");
    }
};