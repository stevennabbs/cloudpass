'use strict';

var signJwt = require('sequelize').Promise.promisify(require('jsonwebtoken').sign);

// returns an Jwt response that can be used by the application to authenticate a user
function getJwtResponse(apiKey, accountHref, payload){
    //jwt to use in the redirection query
    return signJwt(
        payload,
        apiKey.secret,
        {
            expiresIn: 60,
            issuer: apiKey.tenant.idSites[0].url,
            subject: accountHref,
            audience: apiKey.id,
            header: {kid: apiKey.id}
        }
    );
}
exports.getJwtResponse = getJwtResponse;