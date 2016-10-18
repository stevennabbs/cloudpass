"use strict";

module.exports = function (sequelize, DataTypes) {
    return sequelize.define(
            'idSite',
            {
                id: {
                    primaryKey: true,
                    type: DataTypes.UUID,
                    allowNull: false,
                    defaultValue: DataTypes.UUIDV4
                },
                url: {
                    type: DataTypes.STRING,
                    validate: {isUrl: true},
                    defaultValue: 'http://id.stormpath.io'
                },
                logoUrl: {
                    type: DataTypes.STRING,
                    validate: {isUrl: true}
                },
                sessionTtl: {
                    type: DataTypes.STRING(20),
                    allowNull: false,
                    defaultValue: 'PT30M'
                },
                sessionCookiePersistent: {
                    type: DataTypes.BOOLEAN,
                    allowNull: false,
                    defaultValue: true
                }
            },
            {
                classMethods: {
                    getSettableAttributes: function(){
                        return ['url', 'logoUrl', 'sessionTtl', 'sessionCookiePersistent'];
                    },
                    associate: function(models) {
                        models.group.belongsTo(models.tenant, {onDelete: 'cascade'});
                    }
                }
            }
    );
};
