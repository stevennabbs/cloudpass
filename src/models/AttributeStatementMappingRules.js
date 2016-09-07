"use strict";

var _ = require('lodash');
var ApiError = require('../ApiError');

module.exports = function (sequelize, DataTypes) {
    return sequelize.define(
        'attributeStatementMappingRules',
        {
            id: {
                primaryKey: true,
                type: DataTypes.UUID,
                allowNull: false,
                defaultValue: DataTypes.UUIDV4
            },
            items: {
                type: DataTypes.STRING,
                defaultValue: '[]',
                get: function() {
                    return JSON.parse(this.getDataValue('items'));
                }, 
                set: function(val) {
                    return this.setDataValue('items', JSON.stringify(val));
                },
                validate: {
                    isRuleArray: function(value){
                        var items = JSON.parse(value);
                        ApiError.assert(_.isArray(items), 'Items must be an array '+items);
                        items.forEach(function(rule){
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
            },
            classMethods: {
                getSettableAttributes: function(){
                    return ['items'];  
                },
                associate: function(models){
                    models.attributeStatementMappingRules.belongsTo(models.tenant, {onDelete: 'cascade'});
                }
            }
        }
    );
};