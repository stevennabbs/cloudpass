var request = require('supertest-as-promised');
var randomstring = require("randomstring");
var ms = require('smtp-tester');
var BluebirdPromise = require('sequelize').Promise;
var signJwt = BluebirdPromise.promisify(require('jsonwebtoken').sign);

exports.postRequest = function(path){
    return request(exports.app).post('/v1/'+path)
        .auth(exports.apiKey.id, exports.apiKey.secret)
        .set('Content-Type', 'application/json');
};

exports.getRequest = function(path){
        return request(exports.app).get('/v1/'+path)
        .auth(exports.apiKey.id, exports.apiKey.secret);
};

exports.deleteRequest = function(path){
        return request(exports.app).del('/v1/'+path)
        .auth(exports.apiKey.id, exports.apiKey.secret);
};

exports.getMailServer = function(){
    return ms.init(20030, {disableDNSValidation: true});
};

exports.getEmailPromise = function (mailServer, address) {
        return BluebirdPromise.fromCallback(
            function (callback) {
                mailServer.bind(address, function handler(addr, id, email) {
                    mailServer.unbind(address, handler);
                    mailServer.remove(id);
                    callback(null, email);
                });
            }
        ).timeout(1000);
    };

exports.randomName = randomstring.generate;

exports.getIdSiteJwtRequest = function(applicationId, callbackUrl, organizationName){
    return signJwt(
        {
            cb_uri: callbackUrl,
            onk: organizationName
        },
        exports.apiKey.secret,
        {
            issuer: exports.apiKey.id,
            subject: 'http://localhost:20020/v1/applications/'+applicationId,
            header: {kid: exports.apiKey.id}
        }
    );
};

exports.getIdSiteBearer = function(applicationId, callbackUrl, organizationName){
    return exports.getIdSiteJwtRequest(applicationId, callbackUrl, organizationName)
        .then(function(jwtRequest){
                //send it it cloudpass, it should redirect to ID site
                return request(exports.app).get('/sso')
                   .query({ jwtRequest: jwtRequest})
                   .expect(302)
                   .toPromise();
        })
        .then(function(res){
            var fragmentStart = '/#/?jwt=';
            return res.header.location.substring(res.header.location.indexOf(fragmentStart) + fragmentStart.length);
        });
};

before(function(){
    return require('../../src/main')
        .then(function(app){
            //register (create a tenant)
            exports.app = app;
            return request(app)
                .post('/registration')
                .send('tenantNameKey=test-tenant')
                .send('email=test@example.com')
                .send('givenName=test')
                .send('surname=test')
                .send('password=Aa123456')
                .expect(204)
                .toPromise();
        })
        .then(function(){
            //login
            return request(exports.app)
                .post('/login')
                .send('tenantNameKey=test-tenant')
                .send('email=test@example.com')
                .send('password=Aa123456')
                .expect(204)
                .toPromise();
        })
        .then(function(res){
            var cookie = res.header['set-cookie'][0].split(';')[0];
            return request(exports.app)
                    .get('/v1/accounts/current')
                    .set('Cookie', cookie)
                    .expect(302)
                    .then(function(res){
                        return request(exports.app)
                            .post('/v1/accounts/'+res.header.location+'/apiKeys')
                            .set('Cookie', cookie)
                            .expect(200)
                            .toPromise();
                    });
        })
        .then(function(res){
            exports.apiKey = res.body;
        })
        .then(function(){
            //logout
            return request(exports.app)
                .get('/logout')
                .expect(204);
        });
            
});

after(function(){
    exports.app.close();
    require('../../src/models').sequelize.close();
});
