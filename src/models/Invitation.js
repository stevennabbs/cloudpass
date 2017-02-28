"use strict";

module.exports = function (sequelize, DataTypes) {
    return sequelize.define(
            'invitation',
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
                callbackUri: {
                    type: DataTypes.STRING,
                    validate: {isUrl: true}
                }
            },
            {
                classMethods: {
                   getSearchableAttributes: function(){
                        return ['email'];
                   },
                   getSettableAttributes: function(){
                        return ['email', 'callbackUri', 'application', 'organization', 'account', 'customData'];
                    },
                    isCustomizable: function(){
                      return true;
                    },
                    associate: function(models) {
                        models.invitation.belongsTo(models.tenant, {onDelete: 'cascade'});
                        models.invitation.belongsTo(models.application, {onDelete: 'cascade'});
                        models.invitation.belongsTo(models.organization, {onDelete: 'cascade'});
                        models.invitation.belongsTo(models.account, {as: 'fromAccount', onDelete: 'cascade'});
                    }
                }
            }
    );
};
