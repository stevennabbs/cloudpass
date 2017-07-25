"use strict";

var fs = require("fs");
var yaml = require('js-yaml');
var _ = require('lodash');
var defaultEmailVerificationEmail = yaml.safeLoad(fs.readFileSync(__dirname+'/../templates/emailVerification.yaml', 'utf8'));
var defaultEmailVerificationSuccessEmail = yaml.safeLoad(fs.readFileSync(__dirname+'/../templates/emailVerificationSuccess.yaml', 'utf8'));
var defaultWelcomeEmail = yaml.safeLoad(fs.readFileSync(__dirname+'/../templates/welcome.yaml', 'utf8'));

module.exports = function (sequelize, DataTypes) {
    return sequelize.define(
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
                    return accountCreationPolicy.sequelize.Promise.join(
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
            },
            classMethods: {
                getSettableAttributes: function(){
                    return ['verificationEmailStatus', 'verificationSuccessEmailStatus', 'welcomeEmailStatus'];
                },
                associate: function(models) {
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
            }
        }
    );
};