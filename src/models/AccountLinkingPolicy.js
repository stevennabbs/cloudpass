"use strict";

const ModelDecorator = require('./helpers/ModelDecorator');

module.exports = function (sequelize, DataTypes) {
    return new ModelDecorator(
        sequelize.define(
            'accountLinkingPolicy',
            {
                id: {
                    primaryKey: true,
                    type: DataTypes.UUID,
                    allowNull: false,
                    defaultValue: DataTypes.UUIDV4
                },
                status: {
                    type: DataTypes.STRING(8),
                    validate: {isIn: [['ENABLED', 'DISABLED']]},
                    allowNull: false,
                    defaultValue: 'DISABLED'
                },
                automaticProvisioning: {
                    type: DataTypes.STRING(8),
                    validate: {isIn: [['ENABLED', 'DISABLED']]},
                    allowNull: false,
                    defaultValue: 'DISABLED'
                }
            }
        )
    )
    .withClassMethods({
        associate: models => {
            models.accountLinkingPolicy.belongsTo(models.tenant, {onDelete: 'cascade'});
        }
    })
    .withSettableAttributes('status', 'automaticProvisioning', 'matchingProperty')
    .end();
};