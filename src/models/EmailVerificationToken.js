"use strict";

module.exports = function (sequelize, DataTypes) {
    return sequelize.define(
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
            timestamps: false,
            instanceMethods:{
              getIdSitePath: () => '/#/verify'
            },
            classMethods: {
                getHref: function(id){
                    return this.sequelize.models.account.getHref('emailVerificationTokens') + '/' + id;
                },
                associate: function(models) {
                    models.emailVerificationToken.belongsTo(models.tenant, {onDelete: 'cascade'});
                    models.emailVerificationToken.hasOne(models.account, {onDelete: 'set null'});
                }
            }
        }
    );
};