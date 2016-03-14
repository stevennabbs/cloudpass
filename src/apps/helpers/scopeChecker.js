'use strict';

var scopeHelper = require('./scopeHelper');

module.exports = function (req, res, next) {
    if (req.authInfo && req.authInfo.scope){
        var allowedPaths = scopeHelper.scopeToPaths(req.authInfo.scope);
        var requestPath = req.path;
        //check if a the request falls within the authorized scope
        if(!allowedPaths[requestPath] || allowedPaths[requestPath].indexOf(req.method.toLowerCase()) < 0){
            return res.status(403).send();
        }
    }
    req.next();
};