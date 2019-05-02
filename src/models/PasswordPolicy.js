"use strict";

const fs = require("fs");
const yaml = require('js-yaml');
const _ = require('lodash');
const ApiError = require('../ApiError');
const defaultPasswordResetEmail = yaml.safeLoad(fs.readFileSync(__dirname + '/../templates/resetPassword.yaml', 'utf8'));
const defaultPasswordResetSuccessEmail = yaml.safeLoad(fs.readFileSync(__dirname + '/../templates/resetPasswordSuccess.yaml', 'utf8'));
const ModelDecorator = require('./helpers/ModelDecorator');

module.exports = function (sequelize, DataTypes) {
    return new ModelDecorator(
        sequelize.define(
            'passwordPolicy',
            {
                id: {
                    primaryKey: true,
                    type: DataTypes.UUID,
                    allowNull: false,
                    defaultValue: DataTypes.UUIDV4
                },
                resetEmailStatus: {
                    type: DataTypes.STRING(8),
                    validate: {isIn: [['ENABLED', 'DISABLED']]},
                    allowNull: false,
                    defaultValue: 'DISABLED'
                },
                resetSuccessEmailStatus: {
                    type: DataTypes.STRING(8),
                    validate: {isIn: [['ENABLED', 'DISABLED']]},
                    allowNull: false,
                    defaultValue: 'DISABLED'
                },
                resetTokenTtl: {
                    type: DataTypes.INTEGER,
                    validate: {min: 1, max: 168},
                    defaultValue: 24
                },
                maxLength: {
                    type: DataTypes.INTEGER,
                    validate: {min: 0},
                    defaultValue: 100,
                    roles: {strength: true}
                },
                minLength: {
                    type: DataTypes.INTEGER,
                    validate: {min: 0},
                    defaultValue: 8,
                    roles: {strength: true}
                },
                minLowerCase: {
                    type: DataTypes.INTEGER,
                    validate: {min: 0},
                    defaultValue: 1,
                    roles: {strength: true}
                },
                minNumeric: {
                    type: DataTypes.INTEGER,
                    validate: {min: 0},
                    defaultValue: 1,
                    roles: {strength: true}
                },
                minSymbol: {
                    type: DataTypes.INTEGER,
                    validate: {min: 0},
                    defaultValue: 0,
                    roles: {strength: true}
                },
                minUpperCase: {
                    type: DataTypes.INTEGER,
                    validate: {min: 0},
                    defaultValue: 1,
                    roles: {strength: true}
                },
                minDiacritic: {
                    type: DataTypes.INTEGER,
                    validate: {min: 0},
                    defaultValue: 0,
                    roles: {strength: true}
                },
                strength: {
                    type: DataTypes.VIRTUAL(DataTypes.JSON),
                    get() {
                        return {href: this.href + "/strength"};
                    }
                }
            },
            {
                setterMethods: {
                    strength: function (attributes) {
                        this.set(
                            _.pickBy(attributes, function (v, k) {
                                return _.get(this.constructor.rawAttributes, k + '.roles.strength');
                            }.bind(this)),
                            {role: 'strength'}
                        );
                    }
                },
                hooks: {
                    afterCreate: function (passwordPolicy) {
                        return require('sequelize').Promise.join(
                            passwordPolicy.createResetEmailTemplate(_.defaults({tenantId: passwordPolicy.tenantId}, defaultPasswordResetEmail)),
                            passwordPolicy.createResetSuccessEmailTemplate(_.defaults({tenantId: passwordPolicy.tenantId}, defaultPasswordResetSuccessEmail))
                        );
                    },
                    beforeDestroy: function (passwordPolicy) {
                        //delete associated email templates
                        return passwordPolicy.sequelize.models.emailTemplate.destroy({
                            where: {
                                policyId: passwordPolicy.id,
                                workflowStep: {$in: ['passwordReset', 'passwordResetSuccess']}
                            }
                        });
                    }
                }
            }
        )
    )
        .withInstanceMethods({
            getStrength: function () {
                //return all password-strength-related attributes add add a href
                return _(this.constructor.rawAttributes)
                    .pickBy(function (v) {
                        return v.roles && v.roles.strength;
                    })
                    .keys()
                    .transform(function (result, k) {
                        result[k] = this.get(k, {role: 'strength'});
                    }.bind(this), {})
                    .defaults({'href': this.href + "/strength"})
                    .value();
            },
            validatePassword: function (password) {
                ApiError.assert(
                    password.length >= this.get('minLength', {role: 'strength'}),
                    ApiError, 400, 2007, 'Account password minimum length not satisfied.');
                ApiError.assert(
                    password.length <= this.get('maxLength', {role: 'strength'}),
                    ApiError, 400, 2008, 'Account password maximum length not satisfied.');
                ApiError.assert(
                    password.split('').filter(function (c) {
                        return c.toLowerCase() !== c;
                    }).length >= this.get('minUpperCase', {role: 'strength'}),
                    ApiError, 400, 400, 'Password requires at least %d uppercase character(s).', this.get('minUpperCase', {role: 'strength'}));
                ApiError.assert(
                    password.split('').filter(function (c) {
                        return c.toUpperCase() !== c;
                    }).length >= this.get('minLowerCase', {role: 'strength'}),
                    ApiError, 400, 400, 'Password requires at least %d lowercase character(s).', this.get('minLowerCase', {role: 'strength'}));
                ApiError.assert(
                    password.replace(/[0-9]/g, '').split('').filter(c => c.toUpperCase() === c.toLowerCase()).length >= this.get('minSymbol', {role: 'strength'}),
                    ApiError, 400, 400, 'Password requires at least %d symbolic character(s).', this.get('minSymbol', {role: 'strength'}));
                ApiError.assert(
                    password.replace(/[^0-9]/g, '').length >= this.get('minNumeric', {role: 'strength'}),
                    ApiError, 400, 400, 'Password requires at least %d numeric character(s).', this.get('minNumeric', {role: 'strength'}));
                ApiError.assert(
                    password.replace(/[^\u00C0-\u017E]/g, '').length >= this.get('minDiacritic', {role: 'strength'}),
                    ApiError, 400, 400, 'Password requires at least %d diacritic character(s).', this.get('minDiacritic', {role: 'strength'}));
            }
        })
        .withClassMethods({
            associate: function (models) {
                models.passwordPolicy.belongsTo(models.tenant, {onDelete: 'cascade'});

                models.passwordPolicy.hasMany(
                    models.emailTemplate,
                    {
                        as: 'resetEmailTemplates',
                        foreignKey: 'policyId',
                        constraints: false,
                        scope: {
                            workflowStep: 'passwordReset'
                        }
                    }
                );
                models.passwordPolicy.hasMany(
                    models.emailTemplate,
                    {
                        as: 'resetSuccessEmailTemplates',
                        foreignKey: 'policyId',
                        constraints: false,
                        scope: {
                            workflowStep: 'passwordResetSuccess'
                        }
                    }
                );
            }
        })
        .withSettableAttributes('resetEmailStatus', 'resetSuccessEmailStatus', 'resetTokenTtl')
        .end();
};