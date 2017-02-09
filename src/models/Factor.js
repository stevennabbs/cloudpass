"use strict";

var _ = require('lodash');
var speakeasy = require('speakeasy');
var qr = require('qr-image');
var Optional = require('optional-js');
var hrefHelper = require('../helpers/hrefHelper');

module.exports = function (sequelize, DataTypes) {
    return sequelize.define(
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
                }
            },
            {
                getterMethods: {
                    keyUri: function(){
                        return Optional.ofNullable(this.secret)
                                .map(s => speakeasy.otpauthURL({
                                secret: s,
                                label: Optional.ofNullable(this.issuer).map(i => i+':').orElse('') + this.accountName,
                                issuer: this.issuer,
                                encoding: 'base32'
                            }))
                            .orElse(null);
                    },
                    base64QRImage: function(){
                        return Optional.ofNullable(this.keyUri)
                                .map(u => qr.imageSync(u).toString('base64'))
                                .orElse(null);
                    },
                    challenges: function(){
                        return {href: this.href+'/challenges'};
                    }
                },
                hooks: {
                    beforeCreate: function(instance){
                        instance.set('secret', speakeasy.generateSecret().base32);
                    }
                },
                instanceMethods: {
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
                },
                classMethods: {
                    getSettableAttributes: function() {
                        return ['type', 'status', 'accountName', 'issuer'];
                    },
                    associate: function (models) {
                        models.factor.belongsTo(models.tenant, {onDelete: 'cascade'});
                        models.factor.belongsTo(models.account, {onDelete: 'cascade'});
                    }
                }
            }
    );
};