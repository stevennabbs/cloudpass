"use strict";

var addAccountStoreAccessors = require('./helpers/addAccountStoreAccessors');
var bcrypt = require('sequelize').Promise.promisifyAll(require('bcryptjs'));

module.exports = function (sequelize, DataTypes) {
    return sequelize.define(
        'account',
        {
            id: {
                primaryKey: true,
                type: DataTypes.UUID,
                allowNull: false,
                defaultValue: DataTypes.UUIDV4
            },
            email: {
                type: DataTypes.STRING,
                allowNull: false,
                validate: {isEmail: true},
                //transform to lowercase to allow case insensitive logins
                set : function(val) {
                    this.setDataValue('email', val.toLowerCase());
                }
            },
            username: {
                type: DataTypes.STRING,
                lowercase: true,
                trim: true,
                validate: {len: [0, 255]},
                set : function(val) {
                    this.setDataValue('username', val.toLowerCase());
                }
            },
            password: {
                type: DataTypes.STRING(60),
                allowNull: true,
                validate: {len: [1, 255]},
                roles: { passwordHashing: true }
            },
            givenName: {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue: '',
                validate: {len: [0, 255]}
            },
            middleName: {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue: '',
                validate: {len: [0, 255]}
            },
            surname: {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue: '',
                validate: {len: [0, 255]}
            },
            status:{
                type: DataTypes.STRING(10),
                validate: {isIn: [['ENABLED', 'DISABLED', 'UNVERIFIED']]},
                allowNull: false,
                defaultValue: 'ENABLED'
            }
        },
        {
            getterMethods: {
                fullName: function() {
                    return this.sequelize.Utils._.compact([this.givenName, this.middleName, this.surname]).join(' ');
                }
            },
            indexes: [
                {
                    unique: true,
                    fields: ['email', 'directoryId']
                },
                {
                   unique: true,
                   fields: ['username', 'directoryId']
               }
            ],
            hooks: {
                beforeCreate: [
                    validateAndHashPassword,
                    function(instance){
                        if(!instance.username){
                            instance.set('username', instance.get('email'));
                        }
                    }
                ],
                beforeUpdate: validateAndHashPassword,
                beforeDestroy: function(instance){
                    if(instance.emailVerificationTokenId){
                        return instance.sequelize.models.emailVerificationToken
                            .destroy({where: {id: instance.emailVerificationTokenId}});
                    }
                }
            },
            instanceMethods:{
                verifyPassword: function(password){
                    var hash = this.get('password', {role: 'passwordHashing'});
                    return hash && bcrypt.compareAsync(password, hash);
                }
            },
            classMethods: {
                getSearchableAttributes: function(){
                    return ['id', 'email', 'username',  'givenName', 'middleName', 'surname', 'status'];
                },
                getSettableAttributes: function(){
                    return ['email', 'username',  'password', 'givenName', 'middleName', 'surname', 'status', 'customData'];
                },
                isCustomizable: function(){
                    return true;  
                },
                associate: function(models) {
                    models.account.belongsTo(models.tenant, {onDelete: 'cascade'});
                    models.account.belongsTo(models.directory, {onDelete: 'cascade'});
                    models.account.belongsTo(models.emailVerificationToken, {onDelete: 'set null'});
                    models.account.hasMany(models.groupMembership, {onDelete: 'cascade'});
                    models.account.hasMany(models.apiKey, {onDelete: 'cascade'});
                    models.account.belongsToMany(
                        models.group,
                        {
                            through: models.groupMembership,
                            onDelete: 'cascade'
                        }
                    );
                },
                afterAssociate: function(models){
                    addAccountStoreAccessors(models.account, models.application);
                    addAccountStoreAccessors(models.account, models.organization);
                }
            }
        }
    );
};

function validateAndHashPassword(instance) {
    var password = instance.get('password', {role: 'passwordHashing'});
    //nothing to do if the password is already hashed
    if (password && !isModularCryptFormat(password)){
        //else validate the password against the password policy and hash it
        return instance.getDirectory({include: [instance.sequelize.models.passwordPolicy]})
            .then(function(directory){
                directory.passwordPolicy.validatePassword(password);
            })
            .then(function(){
                return bcrypt.hashAsync(password, 8);
            })
            .then(function(hash){
                instance.set({'password': hash}, {role: 'passwordHashing'});
            });
    }
}

function isModularCryptFormat(string){
    //this regex tests only for bcrypt MCF
    return /^\$2[axy]?\$\d{2}\$[a-zA-Z0-9./]{53}$/g.test(string);
}