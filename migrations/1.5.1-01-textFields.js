"use strict";

module.exports = {
    up: function (migration, DataTypes, models) {
        return migration.changeColumn(
                'emailTemplates',
                'htmlBody',
                {
                    type: DataTypes.TEXT,
                    allowNull: false
                }
        )
        .then(() => migration.changeColumn(
                    'emailTemplates',
                    'textBody',
                    {
                        type: DataTypes.TEXT,
                        allowNull: false
                    }
            )
        )
        .then(() => migration.changeColumn(
                    'tenants',
                    'customData',
                    {
                        type: DataTypes.TEXT,
                        allowNull: false
                    }
            )
        )
        .then(() => migration.changeColumn(
                    'directories',
                    'customData',
                    {
                        type: DataTypes.TEXT,
                        allowNull: false
                    }
            )
        )
        .then(() => migration.changeColumn(
                    'directories',
                    'description',
                    {
                        type: DataTypes.TEXT,
                        allowNull: false
                    }
            )
        )
        .then(() => migration.changeColumn(
                    'applications',
                    'customData',
                    {
                        type: DataTypes.TEXT,
                        allowNull: false
                    }
            )
        )
        .then(() => migration.changeColumn(
                    'applications',
                    'description',
                    {
                        type: DataTypes.TEXT,
                        allowNull: false
                    }
            )
        )
        .then(() => migration.changeColumn(
                    'groups',
                    'customData',
                    {
                        type: DataTypes.TEXT,
                        allowNull: false
                    }
            )
        )
        .then(() => migration.changeColumn(
                    'groups',
                    'description',
                    {
                        type: DataTypes.TEXT,
                        allowNull: false
                    }
            )
        )
        .then(() => migration.changeColumn(
                    'accounts',
                    'customData',
                    {
                        type: DataTypes.TEXT,
                        allowNull: false
                    }
            )
        )
        .then(() => migration.changeColumn(
                    'organizations',
                    'customData',
                    {
                        type: DataTypes.TEXT,
                        allowNull: false
                    }
            )
        )
        .then(() => migration.changeColumn(
                    'organizations',
                    'description',
                    {
                        type: DataTypes.TEXT,
                        allowNull: false
                    }
            )
        )
        .then(() => migration.changeColumn(
                    'attributeStatementMappingRules',
                    'items',
                    {
                        type: DataTypes.TEXT,
                        allowNull: false
                    }
            )
        )
        .then(() => migration.changeColumn(
                    'samlServiceProviderMetadata',
                    'privateKey',
                    {
                        type: DataTypes.TEXT,
                        allowNull: false
                    }
            )
        )
        .then(() => migration.changeColumn(
                    'samlServiceProviderMetadata',
                    'x509SigningCert',
                    {
                        type: DataTypes.TEXT,
                        allowNull: false
                    }
            )
        )
        .then(() => migration.changeColumn(
                    'directoryProviders',
                    'encodedX509SigningCert',
                    {
                        type: DataTypes.TEXT,
                        allowNull: false
                    }
            )
        )
        .then(() => migration.changeColumn(
                    'accounts',
                    'providerData',
                    {
                        type: DataTypes.TEXT,
                        allowNull: false
                    }
            )
        )
        .then(() => migration.changeColumn(
                    'invitations',
                    'customData',
                    {
                        type: DataTypes.TEXT,
                        allowNull: false
                    }
            )
        );
    }
};