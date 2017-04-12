"use strict";

var fs = require("fs");
var yaml = require('js-yaml');
var _ = require('lodash');

module.exports = {
    up: function(migration, DataTypes, models) {
        return migration.createTable(
            'invitationPolicies',
            {
                id: {
                    primaryKey: true,
                    type: DataTypes.UUID,
                    allowNull: false
                },
                invitationEmailStatus: {
                    type: DataTypes.STRING(8),
                    allowNull: false,
                    defaultValue: 'DISABLED'
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
          return migration.changeColumn(
            'emailTemplates',
            'workflowStep',
            {
               type: DataTypes.STRING(30),
               allowNull: true
            }
          );
        })
        .then(() =>
          migration.addColumn(
            'applications',
            'invitationPolicyId',
            {
              type: DataTypes.UUID,
              references: {model: "invitationPolicies"},
              onDelete: "cascade"
            }
          )
        )
        .then(() => models.application
              .findAll()
              .map(application => application.createInvitationPolicy({tenantId: application.tenantId}))
        );
    },

    down: function(migration) {
        return migration.dropTable('invitationPolicies');
    }
};