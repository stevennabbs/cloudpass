"use strict";

const _ = require('lodash');
const ModelDecorator = require('./helpers/ModelDecorator');

module.exports = function (sequelize, DataTypes) {
    return new ModelDecorator(
        sequelize.define(
            'passwordResetToken',
            {
                id: {
                    primaryKey: true,
                    type: DataTypes.UUID,
                    allowNull: false,
                    defaultValue: DataTypes.UUIDV4
                },
                email: {
                    type: DataTypes.STRING,
                    allowNull: false,
                    validate: {isEmail: true}
                },
                expires: {
                    type: DataTypes.DATE,
                    allowNull: false
                },
                href: {
                    type: DataTypes.VIRTUAL(DataTypes.STRING),
                    get() {
                        return this.constructor.getHref(this.id, this.applicationId);
                    }
                }
            },
            {
                timestamps: false
            }
        )
    )
    .withInstanceMethods({
        isExpired: function(){
            return this.expires <= new Date();
        },
        getIdSitePath: _.constant('/#/reset')
    })
    .withClassMethods({
        getHref: function (id, applicationId) {
            return this.sequelize.models.application.getHref(applicationId)+'/passwordResetTokens/'+id;
        },
        associate: models => {
            models.passwordResetToken.belongsTo(models.tenant, {onDelete: 'cascade'});
            models.passwordResetToken.belongsTo(models.application, {onDelete: 'cascade'});
            models.passwordResetToken.belongsTo(models.account, {onDelete: 'cascade'});
        }
    })
    .end();
};