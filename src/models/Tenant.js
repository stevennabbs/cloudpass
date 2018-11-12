"use strict";

const ModelDecorator = require('./helpers/ModelDecorator');

module.exports = function (sequelize, DataTypes) {
    return new ModelDecorator(
            sequelize.define(
                'tenant',
                {
                    id: {
                        primaryKey: true,
                        type: DataTypes.UUID,
                        allowNull: false,
                        defaultValue: DataTypes.UUIDV4
                    },
                    key: {
                        type: DataTypes.STRING,
                        unique: true,
                        allowNull: false,
                        validate: {len: [1, 63]}
                    },
                    name: {
                        type: DataTypes.STRING,
                        validate: {len: [1, 255]},
                        allowNull: false
                    }
                },
                {
                    indexes:[
                        {
                            unique: true,
                            fields: ['name']
                        },
                        {
                            unique: true,
                            fields: ['key']
                        }
                    ],
                    hooks: {
                        afterCreate: function(tenant){
                            return tenant.createIdSite();
                        }
                    }
                }
            )
        )
        .withClassMethods({
            associate: models => {
                models.tenant.hasMany(models.application, {onDelete: 'cascade'});
                            models.tenant.hasMany(models.directory, {onDelete: 'cascade'});
                            models.tenant.hasMany(models.group, {onDelete: 'cascade'});
                            models.tenant.hasMany(models.account, {onDelete: 'cascade'});
                            models.tenant.hasMany(models.organization, {onDelete: 'cascade'});
                            models.tenant.hasMany(models.idSite, {onDelete: 'cascade'});
            }
        })
        .withSettableAttributes('customData')
        .withAclAttribute('id')
        .withCustomData()
        .end();
};