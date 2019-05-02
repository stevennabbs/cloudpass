"use strict";

const ModelDecorator = require('./helpers/ModelDecorator');

module.exports = function (sequelize, DataTypes) {
    return new ModelDecorator(
        sequelize.define(
            'samlServiceProviderMetadata',
            {
                id: {
                    primaryKey: true,
                    type: DataTypes.UUID,
                    allowNull: false,
                    defaultValue: DataTypes.UUIDV4
                },
                privateKey: {
                    type: DataTypes.TEXT,
                    allowNull: false,
                    roles: {serviceProvider: true}
                },
                x509SigningCert: {
                    type: DataTypes.TEXT,
                    allowNull: false
                },
                directoryId: {
                    //only needed to compute the entity ID & assertion endpoint
                    type: DataTypes.UUID,
                    allowNull: false,
                    roles: {serviceProvider: true}
                },
                assertionConsumerServicePostEndpoint: {
                    type: DataTypes.VIRTUAL(DataTypes.STRING),
                    get() {
                        return this.sequelize.models.directory.getHref(this.get('directoryId', {role: 'serviceProvider'})) + '/saml/sso/post';
                    }
                },
                entityId: {
                    type: DataTypes.VIRTUAL(DataTypes.STRING),
                    get() {
                        return 'urn:cloudpass:directory:' + this.get('directoryId', {role: 'serviceProvider'}) + ':provider:sp';
                    }
                }
            },
            {
                name: {
                    singular: 'samlServiceProviderMetadata',
                    plural: 'samlServiceProviderMetadatas' // *cringes*
                }
            }
        )
    )
        .withClassMethods({
            associate: models => {
                models.samlServiceProviderMetadata.belongsTo(models.tenant, {onDelete: 'cascade'});
            }
        })
        .end();
};