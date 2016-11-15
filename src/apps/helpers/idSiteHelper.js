'use strict';

var signJwt = require('sequelize').Promise.promisify(require('jsonwebtoken').sign);

// returns an Jwt response that can be used by the application to authenticate a user
function getJwtResponse(apiKey, cbUri, initialJwtId, isNewSub, accountHref, state){
    //jwt to use in the redirection query
    return signJwt(
        {
            isNewSub: isNewSub,
            status: "AUTHENTICATED",
            cb_uri: cbUri,
            irt: initialJwtId,
            state: state
        },
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