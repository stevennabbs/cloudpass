"use strict";

var util = require('util');
var thr = require('throw');

function ApiError(status, code) {
    Error.captureStackTrace(this, this.constructor);
    this.name = this.constructor.name;
    this.status = status;
    this.code = code;
    this.message = util.format.apply(null, Array.prototype.slice.call(arguments, 2));
    this.developerMessage = this.message;
    this.moreInfo = '';
}
util.inherits(ApiError, Error);

ApiError.prototype.write = function (res) {
    return res.status(this.status).json(this);
};

ApiError.BAD_REQUEST = function (message) {
    return new ApiError(400, 400, message);
};
ApiError.UNAUTHORIZED = new ApiError(401, 401, 'Authentication required.', 'Authentication with a valid API Key is required.');
ApiError.FORBIDDEN = new ApiError(403, 403, 'Sorry, you\'re not allowed to do that');
ApiError.NOT_FOUND = new ApiError(404, 404, 'The requested resource does not exist');
ApiError.INVALID_TOKEN = new ApiError(400, 10017, 'Invalid token');
ApiError.FROM_ERROR = function (error) {
    return (error instanceof ApiError) ? error : new ApiError(500, 500, error.message || 'error');
};
ApiError.assert = function(condition){
     if(!condition){
         thr.apply(null, Array.prototype.slice.call(arguments, 1));
     }
};

module.exports = ApiError;
