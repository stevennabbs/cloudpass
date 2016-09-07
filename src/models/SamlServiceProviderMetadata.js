"use strict";

module.exports = function (sequelize, DataTypes) {
    return sequelize.define(
        'samlServiceProviderMetadata',
        {
            id: {
                primaryKey: true,
                type: DataTypes.UUID,
                allowNull: false,
                defaultValue: DataTypes.UUIDV4
            },
            privateKey: {
                type: DataTypes.STRING,
                allowNull: false,
                roles: { serviceProvider: true }
            },
            x509SigningCert: {
                type: DataTypes.STRING(2000),
                allowNull: false
            },
            directoryId: {
                //only needed to compute the entity ID & assertion endpoint
                type: DataTypes.UUID,
                allowNull: false,
                roles: { serviceProvider: true }
            }
        },
        {
            name: {
               singular: 'samlServiceProviderMetadata',
               plural: 'samlServiceProviderMetadatas' // *cringes*
            },
            getterMethods: {
                assertionConsumerServicePostEndpoint: function() {
                    return this.sequelize.models.directory.getHref(this.get('directoryId', {role: 'serviceProvider'}))+'/saml/sso/post';
                },
                entityId: function(){
                    return 'urn:cloudpass:directory:'+this.get('directoryId', {role: 'serviceProvider'})+':provider:sp';
                }
            },
            classMethods: {
                associate: function(models){
                    models.samlServiceProviderMetadata.belongsTo(models.tenant, {onDelete: 'cascade'});
                }
            }
        }
    );
};