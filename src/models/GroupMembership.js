"use strict";

module.exports = function (sequelize, DataTypes) {
    return sequelize.define(
            'groupMembership',
            {
                id: {
                    primaryKey: true,
                    type: DataTypes.UUID,
                    allowNull: false,
                    defaultValue: DataTypes.UUIDV4
                }
            },
            {
                indexes: [
                    {
                        unique: true,
                        fields: ['accountId', 'groupId', 'tenantId']
                    }
                ],
                classMethods: {
                    associatePriority: function(){
                        //'through' association seem to reset the instance prototypes
                        //the associations of accountStoreMappings must be declared last
                        return 1;
                    },
                    getSettableAttributes: function(){
                        return ['group', 'account'];
                    },
                    associate: function(models) {
                        models.groupMembership.belongsTo(models.tenant, {onDelete: 'cascade'});
                        models.groupMembership.belongsTo(models.account, {onDelete: 'cascade'});
                        models.groupMembership.belongsTo(models.group, {onDelete: 'cascade'});
                    }
                }
            }
    );
};