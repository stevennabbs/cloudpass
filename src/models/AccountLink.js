"use strict";

const ModelDecorator = require('./helpers/ModelDecorator');

module.exports = function (sequelize, DataTypes) {
    return new ModelDecorator(
        sequelize.define(
            'accountLink',
            {
                id: {
                    primaryKey: true,
                    type: DataTypes.UUID,
                    allowNull: false,
                    defaultValue: DataTypes.UUIDV4
                }
            },
            {
                indexes: [{
                    unique: true,
                    fields: ['leftAccountId', 'rightAccountId']
                }]
            }
        )
    )
    .withClassMethods({
        associate: models => {
            models.accountLink.belongsTo(models.tenant, {onDelete: 'cascade'});
            models.accountLink.belongsTo(models.account, {as: 'leftAccount', onDelete: 'cascade'});
            models.accountLink.belongsTo(models.account, {as: 'rightAccount', onDelete: 'cascade'});
        }
    })
    .withSettableAttributes('leftAccount', 'rightAccount')
    .end();
};