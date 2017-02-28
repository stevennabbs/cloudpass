"use strict";
module.exports = {
    up: function(migration, DataTypes) {
        return migration.createTable(
            'emailTemplates',
            {
                id: {
                    primaryKey: true,
                    type: DataTypes.UUID,
                    allowNull: false
                },
                policyId: {
                    type: DataTypes.UUID,
                    allowNull: false
                },
                workflowStep: {
                    type: DataTypes.STRING(30),
                    allowNull: false
                },
                fromEmailAddress: {
                    type: DataTypes.STRING,
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
                    defaultValue: ''
                },
                textBody: {
                    type: DataTypes.STRING(1024),
                    allowNull: false,
                    defaultValue: ''
                },
                mimeType: {
                    type: DataTypes.ENUM('text/plain', 'text/html'),
                    allowNull: false,
                    defaultValue: 'text/plain'
                },
                linkBaseUrl: {
                    type: DataTypes.STRING,
                    defaultValue: 'https://change.me.example.com'
                },
                createdAt: {
                    allowNull: false,
                    type: DataTypes.DATE
                },
                modifiedAt: {
                    allowNull: false,
                    type: DataTypes.DATE
                },
                tenantId:{
                    type: DataTypes.UUID,
                    allowNull: false,
                    references: {model: "tenants"},
                    onDelete: "cascade"
                }
            }
        )
        .then(function(){
            return migration.addIndex('emailTemplates', ['policyId', 'tenantId']);
        });
    },

    down: function(migration) {
        return migration.dropTable("emailTemplates");
    }
};