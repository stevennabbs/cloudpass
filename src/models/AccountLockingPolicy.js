"use strict";

const fs = require("fs");
const yaml = require('js-yaml');
const _ = require('lodash');
const defaultAccountLockedEmail = yaml.safeLoad(fs.readFileSync(__dirname+'/../templates/accountLocked.yaml', 'utf8'));
const ModelDecorator = require('./helpers/ModelDecorator');

module.exports = function (sequelize, DataTypes) {
    return new ModelDecorator(
        sequelize.define(
            'accountLockingPolicy',
            {
                id: {
                    primaryKey: true,
                    type: DataTypes.UUID,
                    allowNull: false,
                    defaultValue: DataTypes.UUIDV4
                },
                accountLockedEmailStatus: {
                    type: DataTypes.STRING(8),
                    validate: {isIn: [['ENABLED', 'DISABLED']]},
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
                }
            },
            {
                hooks: {
                    afterCreate: accountLockingPolicy => accountLockingPolicy.createAccountLockedEmailTemplate(_.defaults({tenantId: accountLockingPolicy.tenantId}, defaultAccountLockedEmail)),
                    beforeDestroy: accountLockingPolicy =>
                        //delete associated email templates
                        accountLockingPolicy.sequelize.models.emailTemplate.destroy({
                            where: {
                                policyId: accountLockingPolicy.id,
                                workflowStep: 'accountLocked'
                            }
                        })
                }
            }
        )
    )
    .withClassMethods({
        associate: models => {
            models.accountLockingPolicy.belongsTo(models.tenant, {onDelete: 'cascade'});
            models.accountLockingPolicy.hasMany(
                models.emailTemplate,
                {
                    as: 'accountLockedEmailTemplates',
                    foreignKey: 'policyId',
                    constraints: false,
                    scope: {workflowStep: 'accountLocked'}
                }
            );
        }
    })
    .withSettableAttributes('accountLockedEmailStatus', 'maxFailedLoginAttempts', 'accountLockDuration')
    .end();
};