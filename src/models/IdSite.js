"use strict";

const ModelDecorator = require('./helpers/ModelDecorator');

module.exports = function (sequelize, DataTypes) {
    return new ModelDecorator(
        sequelize.define(
            'idSite',
            {
                id: {
                    primaryKey: true,
                    type: DataTypes.UUID,
                    allowNull: false,
                    defaultValue: DataTypes.UUIDV4
                },
                url: {
                    type: DataTypes.STRING,
                    validate: {isURL: {require_tld: false}}
                },
                logoUrl: {
                    type: DataTypes.STRING,
                    validate: {isURL: {require_tld: false}}
                },
                authorizedRedirectURIs: {
                    type: DataTypes.JSON,
                    allowNull: false,
                    defaultValue: ['*']
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
                }
            }
        )
    )
    .withClassMethods({
        associate: models => models.group.belongsTo(models.tenant, {onDelete: 'cascade'})
    })
    .withSettableAttributes('url', 'logoUrl', 'authorizedRedirectURIs', 'sessionTtl', 'sessionCookiePersistent')
    .end();
};
