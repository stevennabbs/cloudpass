//helper methods to create new accounts or groups in resources mapped to account store
//its simply delegates the creation to the default account stores

var ApiError = require('../../ApiError');

exports.createNewAccount = function(attributes, registrationWorflowEnabled){
    return this.getDefaultAccountStoreMapping()
            .then(function(defaultMapping){
                if(!defaultMapping){
                    throw new ApiError(400, 5101, 'The account storage location is unspecified.');
                }
                return defaultMapping.getAccountStore();
            }).then(function(defaultAccountStore){
                return defaultAccountStore.createNewAccount(attributes, registrationWorflowEnabled);
            });
};

exports.createNewGroup = function(attributes){
    return this.getDefaultGroupStoreMapping()
            .then(function(defaultMapping){
                if(!defaultMapping){
                    throw new ApiError(400, 5102, 'The group storage location is unspecified.');
                }
                return defaultMapping.getAccountStore();
            }).then(function(defaultStore){
                return defaultStore.createNewGroup(attributes);
            });
};