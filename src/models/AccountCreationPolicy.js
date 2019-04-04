"use strict";

const fs = require("fs");
const yaml = require('js-yaml');
const _ = require('lodash');
const defaultEmailVerificationEmail = yaml.safeLoad(fs.readFileSync(__dirname+'/../templates/emailVerification.yaml', 'utf8'));
const defaultEmailVerificationSuccessEmail = yaml.safeLoad(fs.readFileSync(__dirname+'/../templates/emailVerificationSuccess.yaml', 'utf8'));
const defaultWelcomeEmail = yaml.safeLoad(fs.readFileSync(__dirname+'/../templates/welcome.yaml', 'utf8'));
const ModelDecorator = require('./helpers/ModelDecorator');

module.exports = function (sequelize, DataTypes) {
    return new ModelDecorator(
        sequelize.define(
            'accountCreationPolicy',
            {
                id: {
                    primaryKey: true,
                    type: DataTypes.UUID,
                    allowNull: false,
                    defaultValue: DataTypes.UUIDV4
                },
                verificationEmailStatus: {
                    type: DataTypes.STRING(8),
                    validate: {isIn: [['ENABLED', 'DISABLED']]},
                    allowNull: false,
                    defaultValue: 'DISABLED'
                },
                verificationSuccessEmailStatus: {
                    type: DataTypes.STRING(8),
                    validate: {isIn: [['ENABLED', 'DISABLED']]},
                    allowNull: false,
                    defaultValue: 'DISABLED'
                },
                welcomeEmailStatus: {
                    type: DataTypes.STRING(8),
                    validate: {isIn: [['ENABLED', 'DISABLED']]},
                    allowNull: false,
                    defaultValue: 'DISABLED'
                }
            },
            {
                hooks: {
                    afterCreate: function(accountCreationPolicy){
                        return require('sequelize').Promise.join(
                            accountCreationPolicy.createVerificationEmailTemplate(_.defaults({tenantId: accountCreationPolicy.tenantId}, defaultEmailVerificationEmail)),
                            accountCreationPolicy.createVerificationSuccessEmailTemplate(_.defaults({tenantId: accountCreationPolicy.tenantId}, defaultEmailVerificationSuccessEmail)),
                            accountCreationPolicy.createWelcomeEmailTemplate(_.defaults({tenantId: accountCreationPolicy.tenantId}, defaultWelcomeEmail))
                        );
                    },
                    beforeDestroy: function(accountCreationPolicy){
                        //delete associated email templates
                        return accountCreationPolicy.sequelize.models.emailTemplate.destroy({
                            where: {
                                policyId: accountCreationPolicy.id,
                                workflowStep: {$in: ['emailVerification', 'emailVerificationSuccess', 'welcome']}
                            }
                        });
                    }
                }
            }
        )
    )
    .withClassMethods({
        associate: models => {
            models.accountCreationPolicy.belongsTo(models.tenant, {onDelete: 'cascade'});
            models.accountCreationPolicy.hasMany(
                    models.emailTemplate,
                    {
                        as: 'verificationEmailTemplates',
                        foreignKey: 'policyId',
                        constraints: false,
                        scope: {
                            workflowStep: 'emailVerification'
                    }
                }
            );
            models.accountCreationPolicy.hasMany(
                    models.emailTemplate,
                    {
                        as: 'verificationSuccessEmailTemplates',
                        foreignKey: 'policyId',
                        constraints: false,
                        scope: {
                            workflowStep: 'emailVerificationSuccess'
                    }
                }
            );
            models.accountCreationPolicy.hasMany(
                    models.emailTemplate,
                    {
                        as: 'welcomeEmailTemplates',
                        foreignKey: 'policyId',
                        constraints: false,
                        scope: {
                            workflowStep: 'welcome'
                    }
                }
            );
        }
    })
    .withSettableAttributes('verificationEmailStatus', 'verificationSuccessEmailStatus', 'welcomeEmailStatus')
    .end();
};