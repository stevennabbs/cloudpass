"use strict";

const fs = require("fs");
const yaml = require('js-yaml');
const _ = require('lodash');
const defaultInvitationEmail = yaml.safeLoad(fs.readFileSync(__dirname+'/../templates/invitation.yaml', 'utf8')); 

module.exports = function (sequelize, DataTypes) {
    return sequelize.define(
        'invitationPolicy',
        {
            id: {
                primaryKey: true,
                type: DataTypes.UUID,
                allowNull: false,
                defaultValue: DataTypes.UUIDV4
            },
            invitationEmailStatus: {
                type: DataTypes.STRING(8),
                validate: {isIn: [['ENABLED', 'DISABLED']]},
                allowNull: false,
                defaultValue: 'DISABLED'
            },
        },
        {
            hooks: {
                afterCreate: function(invitationPolicy){
                    return invitationPolicy.createInvitationEmailTemplate(_.defaults({tenantId: invitationPolicy.tenantId}, defaultInvitationEmail));
                },
                beforeDestroy: function(invitationPolicy){
                    //delete associated email templates
                    return invitationPolicy.sequelize.models.emailTemplate.destroy({
                        where: {
                            policyId: invitationPolicy.id,
                            workflowStep: {$in: ['invitation']}
                        }
                    });
                }
            },
            classMethods: {
                getSettableAttributes: function(){
                    return ['invitationEmailStatus'];  
                },
                associate: function(models) {
                    models.invitationPolicy.belongsTo(models.tenant, {onDelete: 'cascade'});
                    models.invitationPolicy.hasMany(
                            models.emailTemplate,
                            {
                                as: 'invitationEmailTemplates',
                                foreignKey: 'policyId',
                                constraints: false,
                                scope: {workflowStep: 'invitation'}
                           }
                    );
                }
            }
        }
    );
};