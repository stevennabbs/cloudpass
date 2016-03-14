var assert = require("assert");
var BluebirdPromise = require('sequelize').Promise;
var jwt = require('jsonwebtoken');
var request = require('supertest-as-promised');
var init = require('./init');

describe('idSite', function(){
    var application;
    var idSiteUrl = 'http://www.example.com';
    var callbackUrl = 'http://www.example.com/callback';
    
    before(function(){
        //set the ID site URL
        return init.getRequest('tenants/'+init.apiKey.tenantId+'/idSites')
            .query({limit: 1})
            .expect(200)
            .then(function(res){
                return init.postRequest('idSites/'+res.body.items[0].id)
                        .send({url: idSiteUrl})
                        .expect(200)
                        .toPromise();
        }).then(function(){
            //get the admin application
            return init.getRequest('tenants/'+init.apiKey.tenantId+'/applications')
                .query({ name: 'Cloudpass', limit: 1})
                .expect(200)
                .then(function(res){
                    application = res.body.items[0];
                });
        });
    });
    
    function getJwtRequest(){
        return BluebirdPromise.fromCallback(
                function(callback){
                    jwt.sign(
                        {
                            cb_uri: callbackUrl
                        },
                        init.apiKey.secret,
                        {
                            issuer: init.apiKey.id,
                            subject: 'http://localhost:20020/v1/applications/'+application.id
                        },
                        callback.bind(null, null)
                    );
        });
    };
    
    function getBearer(){
        return getJwtRequest()
            .then(function(jwtRequest){
                    //send it it cloudpass, it should redirect to ID site
                    return request(init.app).get('/sso')
                       .query({ jwtRequest: jwtRequest})
                       .expect(302)
                       .toPromise();
            })
            .then(function(res){
                var locationStart = idSiteUrl+'?jwt=';
                assert(res.header.location.startsWith(locationStart));
                return res.header.location.substring(locationStart.length);
            });
    };
    
    it('login', function(){
        return getBearer()
            .then(function(bearer){
                return request(init.app).post('/v1/applications/'+application.id+'/loginAttempts')
                    .set('authorization', 'Bearer '+bearer)
                    .send({
                        type: 'basic',
                        value: new Buffer('test@example.com:Aa123456', 'utf8').toString('base64')
                    })
                    .expect(200)
                    .then(function(res){
                        //there should be a redirection URL in the headers
                        assert(res.header['stormpath-sso-redirect-location']);
                        return request(res.header['stormpath-sso-redirect-location']).get('')
                                .expect(302)
                                .toPromise();
                    })
                    .then(function(res){
                        //cloudpass should redirect us back to the application
                        //and set a cookie for subsequent logins
                        assert(res.header.location);
                        assert(res.header.location.startsWith(callbackUrl+'?jwtResponse='));
                        assert(res.header['set-cookie']);
                        return BluebirdPromise.join(
                                    getJwtRequest(),
                                    res.header['set-cookie'][0].split(';')[0]
                                );
                    })
                    .spread(function(jwtRequest, cookie){
                        //send a a new request with the cookie
                        return request(init.app).get('/sso')
                            .query({ jwtRequest: jwtRequest})
                            .set('Cookie', cookie)
                            .expect(302)
                            .toPromise();
                    })
                    .then(function(res){
                        //cloudpass should redirect directly to the callback URL, not to the ID site
                        assert(res.header.location);
                        assert(res.header.location.startsWith(callbackUrl+'?jwtResponse='));
                    });
            });
    });
    
    it('logout', function(){
        return getJwtRequest()
                .then(function(jwtRequest){
                    return request(init.app).get('/sso/logout')
                            .query({ jwtRequest: jwtRequest})
                            .expect(302)
                            .toPromise();
                })
                .then(function(res){
                    assert(res.header.location);
                    assert.strictEqual(res.header.location, callbackUrl);
                    assert(res.header['set-cookie']);
                    //cookie should be empty
                    assert.strictEqual(res.header['set-cookie'][0].split(';')[0].split('=')[1], '');
                });
    });
    
    it('request with bearer authorization must have a limited scope', function(){
        return getBearer()
                .then(function(bearer){
                    return request(init.app).get('/v1/applications/'+application.id+'/accounts')
                        .set('authorization', 'Bearer '+bearer)
                        .expect(403)
                        .toPromise();
                });
    });
    
    it('ID site model must be exposed by applications', function(){
        return init.getRequest('applications/'+application.id+'/idSiteModel')
                .expect(200)
                .then(function(res){
                    assert(res.body.hasOwnProperty('providers'));
                    assert(res.body.hasOwnProperty('passwordPolicy'));
                    assert(res.body.hasOwnProperty('logoUrl'));
                });
    });
});