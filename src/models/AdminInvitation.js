"use strict";

module.exports = function (sequelize, DataTypes) {
    return sequelize.define(
            'adminInvitation',
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
                }
            },
            {
                classMethods: {
                    associate: function(models) {
                        models.adminInvitation.belongsTo(models.tenant, {onDelete: 'cascade'});
                        models.adminInvitation.belongsTo(models.account, {as: 'fromAccount', onDelete: 'cascade'});
                    }
                }
            }
    );
};
    