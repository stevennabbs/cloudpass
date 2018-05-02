"use strict";
module.exports = {
    up: function(migration, DataTypes) {
      return migration.createTable(
            'accounts',
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
                username: {
                    type: DataTypes.STRING
                },
                password: {
                    type: DataTypes.STRING(60)
                },
                givenName: {
                    type: DataTypes.STRING,
                    allowNull: false,
                    defaultValue: ''
                },
                middleName: {
                    type: DataTypes.STRING,
                    allowNull: false,
                    defaultValue: ''
                },
                surname: {
                    type: DataTypes.STRING,
                    allowNull: false,
                    defaultValue: ''
                },
                status:{
                    type: DataTypes.STRING(10),
                    allowNull: false,
                    defaultValue: 'ENABLED'
                },
                customData: {
                    type: DataTypes.JSON,
                    defaultValue: {},
                    allowNull: false
                },
                providerData: {
                    type: DataTypes.TEXT,
                    defaultValue: '{"providerId": "cloudpass"}',
                    allowNull: false
                },
                passwordAuthenticationAllowed: {
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
                },
                directoryId:{
                    type: DataTypes.UUID,
                    allowNull: false,
                    references: {model: "directories"},
                    onDelete: "cascade"
                },
                emailVerificationTokenId:{
                    type: DataTypes.UUID,
                    references: {model: "emailVerificationTokens"},
                    onDelete: "set null"
                }
            }
        )
        .then(function(){
            return migration.addIndex(
                'accounts',
                ['email', 'directoryId'],
                {indicesType: 'UNIQUE'}
            );
        })
        .then(function(){
            return migration.addIndex(
                'accounts',
                ['username', 'directoryId'],
                {indicesType: 'UNIQUE'}
            );
        });
    },

    down: function(migration) {
        return migration.dropTable("accounts");
    }
};