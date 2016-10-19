"use strict";

var models = require('../../models');
var ApiError = require('../../ApiError');

exports.findAccount = function(applicationId, login){
    //username and password are persisted lowercased to allow for case insensitive search
    var lowerCaseLogin = login.toLowerCase();
    return models.application.build({id: applicationId}, {isNewRecord: false})
            .getAccounts({where: { $or: [{email: lowerCaseLogin}, {username: lowerCaseLogin} ]}, limit: 1})
            .get(0);
};

exports.authenticateAccount = function(applicationId, login, password, accountStoreRef){
    return exports.findAccount(applicationId, login, accountStoreRef)
                    .tap(function(account){
                       ApiError.assert(account, ApiError, 400, 7104, 'Login attempt failed because there is no Account in the Application’s associated Account Stores with the specified username or email.');
                       ApiError.assert(account.status === 'ENABLED', ApiError, 400, 7101, 'Login attempt failed because the account is not enabled.');
                       return account
                               .verifyPassword(password)
                               .then(function(result){
                                   ApiError.assert(result, ApiError, 400, 7100, 'Login attempt failed because the specified password is incorrect.');
                               });
                    });
};
