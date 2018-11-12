"use strict";
module.exports = {
    up: function(migration, DataTypes, models) {
        return migration.createTable(
            'accountLinkingPolicies',
            {
                id: {
                    primaryKey: true,
                    type: DataTypes.UUID,
                    allowNull: false
                },
                status: {
                    type: DataTypes.STRING(8),
                    allowNull: false,
                    defaultValue: 'DISABLED'
                },
                automaticProvisioning: {
                    type: DataTypes.STRING(8),
                    allowNull: false,
                    defaultValue: 'DISABLED'
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
        .then(() =>
          migration.addColumn(
            'applications',
            'accountLinkingPolicyId',
            {
              type: DataTypes.UUID,
              references: {model: "accountLinkingPolicies"},
              onDelete: "cascade"
            }
          )
        )
        .then(() => models.application
              .findAll({attributes: ['id', 'tenantId']})
              .map(application => application.createAccountLinkingPolicy({tenantId: application.tenantId}))
        );
    },

    down: function(migration) {
        return migration.dropTable("accountLinkingPolicies");
    }
};