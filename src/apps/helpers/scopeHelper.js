var _ = require('lodash');

//get the scope of requests an ID site is allowed to make with its bearer token
exports.getIdSiteScope = function(applicationId){
    var applicationScope = {};
    applicationScope[applicationId] = [
        "read",
        { idSiteModels: [ "read" ] },
        { loginAttempts: [ "create" ] },
        { accounts: [ "create" ] },
        { passwordResetTokens: [ "create" ] }
    ];
    return {applications: applicationScope};
};

exports.scopeToPaths = function(scope, baseUrl){
    baseUrl = baseUrl || '';
    if(_.isString(scope)){
        //the scope is simply a permission (read, create etc.)
        //map the URL to the corresponding HTTP method
        var result = {};
        result[baseUrl] = [scopePermissionToHttpMethod(scope)];
        return result;
    }
    if(_.isArray(scope)){
        //find the paths associated with each of the array item and merge them
        return _(scope)
            .map(_.partial(exports.scopeToPaths, _, baseUrl))
            .reduce(function(result, path){
                //concat the arrays of http methods if there is path collision
                return _.mergeWith(result, path, function(a, b){
                    if(_.isArray(a)){
                        return a.concat(b);
                    }
                });
            });
    }
    if(_.isObject(scope)){
        //keys are path segments, values are the associated scopes
        return _(scope)
            .toPairs()
            .map(_.spread(function(k, v){
                 return exports.scopeToPaths(v, baseUrl+'/'+k);
            }))
            //concat the paths (no collision possible because keys are different)
            .reduce(_.merge);
    }
};

function scopePermissionToHttpMethod(perm){
    switch(perm){
        case 'read':
            return 'get';
        case 'create':
        case 'write':
            return 'post';
        case 'delete':
            return 'delete';
    }
}