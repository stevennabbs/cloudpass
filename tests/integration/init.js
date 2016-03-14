var request = require('supertest-as-promised');
var randomstring = require("randomstring");
var ms = require('smtp-tester');
var BluebirdPromise = require('sequelize').Promise;
var models = require('../../src/models');

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
                    mailServer.remove(id-1);
                    callback(null, email);
                });
            }
        ).timeout(1000);
    };

exports.randomName = randomstring.generate;

before(function(){
    this.timeout(0);
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
        });
            
});

after(function(){
    exports.app.close();
    models.sequelize.close();
});
