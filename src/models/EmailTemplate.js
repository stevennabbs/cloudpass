"use strict";

module.exports = function (sequelize, DataTypes) {
    return sequelize.define(
            'emailTemplate',
            {
                id: {
                    primaryKey: true,
                    type: DataTypes.UUID,
                    allowNull: false,
                    defaultValue: DataTypes.UUIDV4
                },
                policyId: {
                    type: DataTypes.UUID,
                    validate: {isUUID: 4},
                    allowNull: false
                },
                workflowStep: {
                    type: DataTypes.STRING(30),
                    validate: {isIn: [['passwordReset', 'passwordResetSuccess', 'emailVerification', 'emailVerificationSuccess', 'welcome', 'invitation']]},
                    allowNull: false
                },
                fromEmailAddress: {
                    type: DataTypes.STRING,
                    validate: {isEmail: true},
                    allowNull: false,
                    defaultValue: 'change-me@example.com'
                },
                fromName: {
                    type: DataTypes.STRING,
                    allowNull: false,
                    defaultValue: 'Change Me'
                },
                subject: {
                    type: DataTypes.STRING(78),
                    validate: {len: [1, 78]},
                    allowNull: false                    
                },
                htmlBody: {
                    type: DataTypes.STRING(1024),
                    allowNull: false,
                    validate: {len: [0, 1024]},
                    defaultValue: ''
                },
                textBody: {
                    type: DataTypes.STRING(1024),
                    allowNull: false,
                    validate: {len: [0, 1024]},
                    defaultValue: ''
                },
                mimeType: {
                    type: DataTypes.ENUM('text/plain', 'text/html'),
                    allowNull: false,
                    defaultValue: 'text/plain'
                },
                linkBaseUrl: {
                    type: DataTypes.STRING,
                    validate: {isUrl: true},
                    roles: { defaultModel : true }
                },
                mandrillTemplate: {
                    type: DataTypes.STRING,
                    allowNull: true
                }
            },
            {
                indexes: [{ fields: ['policyId', 'tenantId'] }],
                getterMethods: {
                    defaultModel: function(){
                        var linkBaseUrl = this.get('linkBaseUrl', {role: 'defaultModel'});
                        return linkBaseUrl? {linkBaseUrl : linkBaseUrl}: undefined;
                    }
                },
                setterMethods: {
                    defaultModel: function(value){
                        if(value.linkBaseUrl){
                            this.set('linkBaseUrl', value.linkBaseUrl, {role: 'defaultModel'});
                        }
                    }
                },
                instanceMethods: {
                    getUrlTokens : function(cpToken){
                        var cpTokenNameValuePair = 'cpToken='+cpToken;
                        return{
                            url: this.get('linkBaseUrl', {role: 'defaultModel'}) + '?'+cpTokenNameValuePair,
                            cpToken: cpToken,
                            cpTokenNameValuePair: cpTokenNameValuePair
                        };
                    }
                },
                classMethods: {
                    getSettableAttributes: function(){
                        return ['fromEmailAddress', 'fromName', 'subject', 'htmlBody', 'textBody', 'mimeType', 'defaultModel', 'linkBaseUrl', 'mandrillTemplate'];  
                     },
                     associate: function(models) {
                         models.emailTemplate.belongsTo(models.tenant, {onDelete: 'cascade'});
                     }
                }
            }
    );
};
    