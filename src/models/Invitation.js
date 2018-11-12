"use strict";

const ModelDecorator = require('./helpers/ModelDecorator');

module.exports = function (sequelize, DataTypes) {
    return new ModelDecorator(
        sequelize.define(
            'invitation',
            {
                id: {
                    primaryKey: true,
                    type: DataTypes.UUID,
                    allowNull: false,
                    defaultValue: DataTypes.UUIDV4
                },
                email: {
                    type: DataTypes.STRING,
                    allowNull: false,
                    validate: {isEmail: true}
                },
                callbackUri: {
                    type: DataTypes.STRING,
                    validate: {isURL: {require_tld: false}}
                }
            }
        )
    )
    .withClassMethods({
        associate: models => {
            models.invitation.belongsTo(models.tenant, {onDelete: 'cascade'});
            models.invitation.belongsTo(models.application, {onDelete: 'cascade'});
            models.invitation.belongsTo(models.organization, {onDelete: 'cascade'});
            models.invitation.belongsTo(models.account, {as: 'fromAccount', onDelete: 'cascade'});
        }
    })
    .withSearchableAttributes('id', 'email')
    .withSettableAttributes('email', 'callbackUri', 'application', 'organization', 'fromAccount', 'customData')
    .withCustomData()
    .end();
};
