"use strict";

const ModelDecorator = require('./helpers/ModelDecorator');

module.exports = function (sequelize, DataTypes) {
    return new ModelDecorator(
        sequelize.define(
            'groupMembership',
            {
                id: {
                    primaryKey: true,
                    type: DataTypes.UUID,
                    allowNull: false,
                    defaultValue: DataTypes.UUIDV4
                }
            },
            {
                indexes: [
                    {
                        unique: true,
                        fields: ['accountId', 'groupId', 'tenantId']
                    }
                ]
            }
        )
    )
    .withClassMethods({
        associate: models => {
            models.groupMembership.belongsTo(models.tenant, {onDelete: 'cascade'});
            models.groupMembership.belongsTo(models.account, {onDelete: 'cascade'});
            models.groupMembership.belongsTo(models.group, {onDelete: 'cascade'});
        }
    })
    .withSettableAttributes('group', 'account')
    .end();
};