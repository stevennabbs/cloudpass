"use strict";
module.exports = {
    up: function(migration, DataTypes, models) {
        return migration.createTable(
            'accountLockingPolicies',
            {
                id: {
                    primaryKey: true,
                    type: DataTypes.UUID,
                    allowNull: false
                },
                accountLockedEmailStatus: {
                    type: DataTypes.STRING(8),
                    allowNull: false,
                    defaultValue: 'DISABLED'
                },
                maxFailedLoginAttempts: {
                    type: DataTypes.INTEGER,
                    defaultValue: 3
                },
                accountLockDuration: {
                    type: DataTypes.STRING(20),
                    allowNull: false,
                    defaultValue: 'PT15M'
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
            'directories',
            'accountLockingPolicyId',
            {
              type: DataTypes.UUID,
              references: {model: "accountLockingPolicies"},
              onDelete: "cascade"
            }
          )
        )
        .then(() => models.directory
              .findAll()
              .map(directory => directory.createAccountLockingPolicy({tenantId: directory.tenantId}))
        )
        .then(() => migration.addColumn(
            'accounts',
            'failedLoginAttempts',
            {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0
            }
        ))
        .then(() => migration.addColumn(
            'accounts',
            'lastLoginAttempt',
            {
                type: DataTypes.DATE
            }
        ));;
    },

    down: function(migration) {
        return migration.dropTable("accountLockingPolicies");
    }
};