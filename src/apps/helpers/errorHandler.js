'use strict';

var _ = require('lodash');
var signJwt = require('sequelize').Promise.promisify(require('jsonwebtoken').sign);
var winston = require('winston');
var ApiError = require('../../ApiError.js');
var sendJwtResponse = require('./sendJwtResponse');

var exceptionToApiError = _.cond([
    //HTTP method not suported
    [
        _.property('allowedMethods'),
        e => new ApiError(405, 405, 'Method not supported (supported method(s): '+e.allowedMethods.join()+')')
    ],
    //unique constraint violation
    [
        _.matches({'name': 'SequelizeUniqueConstraintError'}),
        e => new ApiError(409, 2001, e.errors.length > 0 ? e.errors[0].message+' ('+e.errors[0].value+')': e.message)
    ],
    //Ill-formed query or sequelize validation error
    [
        e => e.statusCode === 400 || _.startsWith(e.message, 'Validation error') || e.name === 'SequelizeValidationError',
        e=> ApiError.BAD_REQUEST(_.isEmpty(e.errors)?e.message:_.isEmpty(e.errors[0].errors)?e.errors[0].message:e.errors[0].errors[0].message)
    ],
    //swagger validation errors (keep the first one)
    [
        _.property('failedValidation'),
        e => ApiError.BAD_REQUEST(_.isEmpty(e.results)?e.message:e.results.errors[0].message)
    ],
    //other errors
    [
        _.stubTrue,
        ApiError.FROM_ERROR
    ]
 ]);

 let logger = winston.loggers.get('http');

module.exports = function (err, req, res, next) {
    var apiError = exceptionToApiError(err);

    if(apiError.status === 500){
        logger.error('Unexpected error:', err.stack);
    } else {
        logger.debug('Request failed:', apiError.message, err.stack);
    }

    if (res.headersSent) {
        return next(err);
    }

    if(_.has(req, 'authInfo.cb_uri') && _.get(req, 'authInfo.aud') !== 'idSite'){
        //redirect the user to the application
        //the authInfo payload could have been generated by Cloudpass (first param of _.defaultsTo)
        //or the application (2nd param)
        return signJwt(
            {
                irt: _.defaultTo(req.authInfo.init_jti, req.authInfo.jti),
                err: apiError
            },
            req.user.secret,
            {
                expiresIn: 60,
                issuer: _.defaultTo(req.authInfo.app_href, req.authInfo.sub)
            }
        )
        .then(sendJwtResponse(res, req.authInfo.cb_uri));
    } else {
        apiError.write(res);
    }
};