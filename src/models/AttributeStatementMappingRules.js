"use strict";

const _ = require('lodash');
const ApiError = require('../ApiError');
const ModelDecorator = require('./helpers/ModelDecorator');

module.exports = function (sequelize, DataTypes) {
    return new ModelDecorator(
        sequelize.define(
            'attributeStatementMappingRules',
            {
                id: {
                    primaryKey: true,
                    type: DataTypes.UUID,
                    allowNull: false,
                    defaultValue: DataTypes.UUIDV4
                },
                items: {
                    type: DataTypes.JSON,
                    defaultValue: [],
                    validate: {
                        isRuleArray: function(value){
                            ApiError.assert(_.isArray(value), 'Items must be an array '+value);
                            value.forEach(function(rule){
                                ApiError.assert(rule.name, 'Rule name is required');
                                ApiError.assert(_.isString(rule.name), 'Rule names must be strings');
                                ApiError.assert(rule.accountAttributes, 'Rule account attributes are required');
                                ApiError.assert(_.isArray(rule.accountAttributes), 'Rule account attributes are required');
                                rule.accountAttributes.forEach(function(attribute){
                                    ApiError.assert(_.startsWith(attribute, 'customData.') || _.includes(['username', 'givenName', 'middleName', 'surname'], attribute), 'Invalid account attribute %s', attribute);
                                });
                            });
                        }
                    }
                }
            },
            {
                name: {
                   singular: 'attributeStatementMappingRules', //one instance can hold multiple rules
                   plural: 'attributeStatementMappingRules'
                }
            }
        )
    )
    .withClassMethods({
        associate: function(models){
            models.attributeStatementMappingRules.belongsTo(models.tenant, {onDelete: 'cascade'});
        }
    })
    .withSettableAttributes('items')
    .end();
};