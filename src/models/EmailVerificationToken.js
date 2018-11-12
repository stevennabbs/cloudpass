"use strict";

const _ = require('lodash');
const ModelDecorator = require('./helpers/ModelDecorator');

module.exports = function (sequelize, DataTypes) {
    return new ModelDecorator(
        sequelize.define(
            'emailVerificationToken',
            {
                id: {
                    primaryKey: true,
                    type: DataTypes.UUID,
                    allowNull: false,
                    defaultValue: DataTypes.UUIDV4
                }
            },
            {
                timestamps: false
            }
        )
    )
    .withInstanceMethods({
        getIdSitePath: _.constant('/#/verify')
    })
    .withClassMethods({
        getHref: function(id){
            return this.sequelize.models.account.getHref('emailVerificationTokens') + '/' + id;
        },
        associate: models => {
            models.emailVerificationToken.belongsTo(models.tenant, {onDelete: 'cascade'});
            models.emailVerificationToken.hasOne(models.account, {onDelete: 'set null'});
        }
    })
    .end();
};