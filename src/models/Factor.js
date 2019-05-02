"use strict";

const _ = require('lodash');
const speakeasy = require('speakeasy');
const qr = require('qr-image');
const Optional = require('optional-js');
const hrefHelper = require('../helpers/hrefHelper');
const ModelDecorator = require('./helpers/ModelDecorator');

module.exports = function (sequelize, DataTypes) {
    return new ModelDecorator(
        sequelize.define(
            'factor',
            {
                id: {
                    primaryKey: true,
                    type: DataTypes.UUID,
                    allowNull: false,
                    defaultValue: DataTypes.UUIDV4
                },
                type: {
                    type: DataTypes.STRING,
                    allowNull: false,
                    validate: {isIn: [['google-authenticator']]}
                },
                status: {
                    type: DataTypes.STRING,
                    validate: {isIn: [['ENABLED', 'DISABLED']]},
                    allowNull: false,
                    defaultValue: 'ENABLED'
                },
                verificationStatus: {
                    type: DataTypes.STRING,
                    validate: {isIn: [['VERIFIED', 'UNVERIFIED']]},
                    allowNull: false,
                    defaultValue: 'UNVERIFIED'
                },
                accountName: {
                    type: DataTypes.STRING,
                    validate: {isEmail: true}
                },
                issuer: {
                    type: DataTypes.STRING,
                    validate: {len: [0, 255]}
                },
                secret: {
                    type: DataTypes.STRING
                },
                keyUri: {
                    type: DataTypes.VIRTUAL(DataTypes.STRING),
                    get() {
                        return Optional.ofNullable(this.secret)
                            .map(s => speakeasy.otpauthURL({
                                secret: s,
                                label: Optional.ofNullable(this.issuer).map(i => i+':').orElse('') + this.accountName,
                                issuer: this.issuer,
                                encoding: 'base32'
                            }))
                            .orElse(null);
                    }
                },
                base64QRImage: {
                    type: DataTypes.VIRTUAL(DataTypes.STRING),
                    get() {
                        return Optional.ofNullable(this.keyUri)
                            .map(u => qr.imageSync(u).toString('base64'))
                            .orElse(null);
                    }
                },
                challenges: {
                    type: DataTypes.VIRTUAL(DataTypes.JSON),
                    get() {
                        return {href: this.href+'/challenges'};
                    }
                }
            },
            {
                hooks: {
                    beforeCreate: function(instance){
                        instance.set('secret', speakeasy.generateSecret().base32);
                    }
                }
            }
        )
    )
    .withInstanceMethods({
        verify: function(code){
            return speakeasy.totp.verify({
                secret: this.secret,
                encoding: 'base32',
                token: code,
                window: 1
            });
        },
        getChallenge: function(status) {
            return {
                id: this.id,
                href: hrefHelper.baseUrl+'challenges/'+this.id,
                createdAt: new Date(),
                modifiedAt:new Date(),
                status,
                type: this.type,
                account: {href: hrefHelper.baseUrl+'accounts/'+this.accountId},
                factor: {href: hrefHelper.baseUrl+'factors/'+this.id},
                getAccount: this.getAccount.bind(this),
                getFactor: _.constant(this)
            };
        }
    })
    .withClassMethods({
        associate: models => {
            models.factor.belongsTo(models.tenant, {onDelete: 'cascade'});
            models.factor.belongsTo(models.account, {onDelete: 'cascade'});
        }
    })
    .withSettableAttributes('type', 'status', 'accountName', 'issuer')
    .end();
};