"use strict";

module.exports = function (sequelize, DataTypes) {
    return sequelize.define(
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
            }
        },
        {
            timestamps: false,
            getterMethods: {
                href: function () {
                    return this.Model.getHref(this.id, this.applicationId);
                }
            },
            instanceMethods:{
              isExpired: function(){
                return this.expires <= new Date();
              },
              getIdSitePath: () => '/#/reset'
            },
            classMethods: {
                getHref: function (id, applicationId) {
                    return this.sequelize.models.application.getHref(applicationId)+'/passwordResetTokens/'+id;
                },
                associate: function(models) {
                    models.passwordResetToken.belongsTo(models.tenant, {onDelete: 'cascade'});
                    models.passwordResetToken.belongsTo(models.application, {onDelete: 'cascade'});
                    models.passwordResetToken.belongsTo(models.account, {onDelete: 'cascade'});
                }
            }
        }
    );
};