'use strict';

var assert = require("assert");
var BluebirdPromise = require('sequelize').Promise;
var jwt = require('jsonwebtoken');
var request = require('supertest');
var speakeasy = require("speakeasy");
var init = require('./init');

describe('idSite', function(){
    var applicationId;
    var idSiteUrl = 'http://www.example.com';
    var callbackUrl = 'http://www.example.com/callback';
    var mailServer;

    before(function(){
        //start the SMTP server
        mailServer = init.getMailServer();
        //set the ID site URL
        return init.getRequest('tenants/'+init.apiKey.tenantId+'/idSites')
            .query({limit: 1})
            .expect(200)
            .then(function(res){
                return init.postRequest('idSites/'+res.body.items[0].id)
                        .send({url: idSiteUrl})
                        .expect(200);
        }).then(function(){
            //get the admin application
            return init.getRequest('tenants/'+init.apiKey.tenantId+'/applications')
                .query({ name: 'Cloudpass', limit: 1, expand: 'defaultAccountStoreMapping'})
                .expect(200)
                .then(function(res){
                    applicationId = res.body.items[0].id;
                    return init.getRequest('directories/'+res.body.items[0].defaultAccountStoreMapping.accountStoreId)
                              .query({expand: 'passwordPolicy,accountCreationPolicy'})
                              .expect(200);
                })
                .then(function(res){
                  //enable password reset workflow
                  return init.postRequest('passwordPolicies/' + res.body.passwordPolicy.id)
                    .send({
                        resetEmailStatus: 'ENABLED',
                        resetSuccessEmailStatus: 'ENABLED'
                    })
                    .expect(200)
                    .then(function(){
                      return init.postRequest('accountCreationPolicies/' + res.body.accountCreationPolicy.id)
                        .send({verificationEmailStatus: 'ENABLED'})
                        .expect(200);
                    });
                });
        });
    });

    after(function () {
      //stop the SMTP server
      mailServer.stop();
    });

    describe('login', function(){
        it('in application', function(){
            return init.getIdSiteBearer(applicationId, {cb_uri: callbackUrl})
                .then(function(bearer){
                    return request(init.app).post('/v1/applications/'+applicationId+'/loginAttempts')
                        .set('authorization', 'Bearer '+bearer)
                        .send({
                            type: 'basic',
                            value: Buffer.from(init.adminUser+':'+init.adminPassword, 'utf8').toString('base64')
                        })
                        .expect(200);
                })
                .then(function(res){
                    //there should be a redirection URL in the headers
                    assert(res.header['stormpath-sso-redirect-location']);
                    return request(res.header['stormpath-sso-redirect-location']).get('')
                            .expect(302);
                })
                .then(function(res){
                    //cloudpass should redirect us back to the application
                    //and set a cookie for subsequent logins
                    assert(res.header.location);
                    assert(res.header.location.startsWith(callbackUrl+'?jwtResponse='));
                    assert(res.header['set-cookie']);
                    return BluebirdPromise.join(
                            init.getIdSiteJwtRequest(applicationId, {cb_uri: callbackUrl}),
                            res.header['set-cookie'][0].split(';')[0]
                        );
                })
                .spread(function(jwtRequest, cookie){
                    return BluebirdPromise.join(
                        //send a a new request with the cookie
                        request(init.app).get('/sso')
                            .query({jwtRequest: jwtRequest})
                            .set('Cookie', cookie)
                            .expect(302),
                        cookie
                    );
                })
                .spread(function(res, cookie){
                    //cloudpass should redirect directly to the callback URL, not to the ID site
                    assert(res.header.location);
                    assert(res.header.location.startsWith(callbackUrl+'?jwtResponse='));
                    return BluebirdPromise.join(
                        init.getIdSiteJwtRequest(applicationId, {cb_uri: callbackUrl, require_mfa: ['google-authenticator']}),
                        cookie
                    );
                })
                .spread(function(jwtRequest, cookie){
                    //send a a new request requiring MFA with the cookie
                    return request(init.app).get('/sso')
                            .query({ jwtRequest: jwtRequest})
                            .set('Cookie', cookie)
                            .expect(302);
                })
                .then(function(res){
                    //cloudpass should redirect to ID site because no 2nd factor has been provided yet
                    assert(res.header.location);
                    assert(res.header.location.startsWith(idSiteUrl+'/#/?jwt='));
                });
            });

            it('in organization', function(){
                //create an organization an map it the the application
                const organizationName = init.randomName();
                var organizationId;
                return init.postRequest('organizations')
                    .send({
                        name: organizationName,
                        nameKey: organizationName
                    })
                    .expect(200)
                    .then(function(res){
                        organizationId = res.body.id;
                        return init.postRequest('accountStoreMappings')
                            .send({
                                application:{href: '/applications/'+applicationId},
                                accountStore:{href: '/organizations/'+res.body.id}
                            })
                            .expect(200);
                    })
                    .then(function(){
                        return init.getIdSiteBearer(applicationId, {cb_uri: callbackUrl, onk: organizationName});
                    })
                    .then(function(bearer){
                       //the bearer should give access to the organization & its ID site model
                       return request(init.app).get('/v1/organizations/'+organizationId)
                                .set('authorization', 'Bearer '+bearer)
                                .query({ expand: 'idSiteModel'})
                                .expect(200)
                                .then(res => {
                                   assert.strictEqual(res.body.name, organizationName);
                                   assert(res.body.idSiteModel.hasOwnProperty('providers'));
                                   assert(res.body.idSiteModel.hasOwnProperty('passwordPolicy'));
                                   assert(res.body.idSiteModel.hasOwnProperty('logoUrl'));
                                })
                                .then(() => bearer);
                    })
                    .then(function(bearer){
                        //Cloudpass should return a 400 because the account is not in this organization
                        return request(init.app).post('/v1/applications/'+applicationId+'/loginAttempts')
                            .set('authorization', 'Bearer '+bearer)
                            .send({
                                type: 'basic',
                                value: Buffer.from('test@example.com:Aa123456', 'utf8').toString('base64')
                            })
                            .expect(400);
                    });
            });

            function getConfiguredFactors(){
                return init.getIdSiteBearer(applicationId, {cb_uri: callbackUrl, require_mfa: ['google-authenticator']})
                    .then(function(bearer){
                        return request(init.app).post('/v1/applications/'+applicationId+'/loginAttempts')
                            .set('authorization', 'Bearer '+bearer)
                            .send({
                                type: 'basic',
                                value: Buffer.from(init.adminUser+':'+init.adminPassword, 'utf8').toString('base64')
                            })
                            .expect(200);
                    })
                    .then(function(res){
                        //there shouldn't be a redirection URL in the headers
                        assert(!res.header['stormpath-sso-redirect-location']);
                        assert(res.header.authorization);

                        //we should be able to retrieve the list of 2nd factors with the new bearer
                        return request(init.app).get('/v1'+res.body.account.href+'/factors')
                                .set('authorization', res.header.authorization)
                                .expect(200);
                    });
            }

            it('with new second factor', function(){
                getConfiguredFactors()
                    .then(function(res){
                        //no 2nd factor configured yet
                        assert.strictEqual(res.body.size, 0);
                        //add one
                        return request(init.app).post('/v1'+res.body.href)
                                .set('authorization', res.header.authorization)
                                .send({
                                    type: 'google-authenticator',
                                    issuer: init.randomName()
                                })
                                .expect(200);
                    })
                    .then(function(res){
                        assert.strictEqual(res.body.verificationStatus, 'UNVERIFIED');
                        //verify the factor
                        return request(init.app).post('/v1/factors/'+res.body.id+'/challenges')
                                .set('authorization', res.header.authorization)
                                .send({code: speakeasy.totp({secret: res.body.secret, encoding: 'base32'})})
                                .expect(200);
                    })
                    .then(function(res){
                        //there should be a redirection URL in the headers
                        assert(res.header['stormpath-sso-redirect-location']);
                        return request(res.header['stormpath-sso-redirect-location']).get('')
                            .expect(302);
                    });
            });

            it('with existing second factor', function(){
                getConfiguredFactors()
                    .then(function(res){
                        //one second factor has already been configured
                        assert.strictEqual(res.body.size, 1);
                        //secret should no be exposed
                        assert(!res.body.items[0].secret);
                        assert(!res.body.items[0].keyUri);
                        assert(!res.body.items[0].base64QRImage);

                        return BluebirdPromise.join(
                                request(init.app).post('/v1/factors/'+res.body.items[0].id+'/challenges')
                                    .set('authorization', res.header.authorization)
                                    .expect(200),
                                res.body.items[0].secret);
                    })
                    .spread(function(res, secret){
                        assert.strictEqual(res.body.status, 'CREATED');
                        //verify the factor
                        return request(init.app).post('/v1/challenges/'+res.body.id)
                                .set('authorization', res.header.authorization)
                                .send({code: speakeasy.totp({secret: secret, encoding: 'base32'})})
                                .expect(200);
                    })
                    .then(function(res){
                        //there should be a redirection URL in the headers
                        assert(res.header['stormpath-sso-redirect-location']);
                        return request(res.header['stormpath-sso-redirect-location']).get('')
                            .expect(302);
                    });
            });
    });

    it('logout', function(){
        return init.getIdSiteJwtRequest(applicationId, {cb_uri: callbackUrl})
                .then(function(jwtRequest){
                    return request(init.app).get('/sso/logout')
                            .query({ jwtRequest: jwtRequest})
                            .expect(302);
                })
                .then(function(res){
                    assert(res.header.location);
                    assert.strictEqual(res.header.location, callbackUrl);
                    assert(res.header['set-cookie']);
                    //cookie should be empty
                    assert.strictEqual(res.header['set-cookie'][0].split(';')[0].split('=')[1], '');
                });
    });

    it('password reset', function(){
      return init.getIdSiteBearer(applicationId, {cb_uri: callbackUrl})
        .then(function(bearer){
           return BluebirdPromise.join(
              init.getEmailPromise(mailServer, init.adminUser),
              request(init.app).post('/v1/applications/'+applicationId+'/passwordResetTokens')
                  .set('authorization', 'Bearer '+bearer)
                  .send({email: init.adminUser})
                  .expect(200)
            );
        })
        .spread(function(email){
           let jwtParam = /\/#\/reset\?jwt=(.*?)\n/.exec(email.body)[1];
           assert(jwtParam);
           let tokenId = jwt.decode(jwtParam).sp_token;
           assert(tokenId);
           return BluebirdPromise.join(
                   init.getEmailPromise(mailServer, init.adminUser),
                   request(init.app).post('/v1/applications/'+applicationId+'/passwordResetTokens/'+tokenId)
                     .set('authorization', 'Bearer '+jwtParam)
                     .send({password: init.adminPassword})
                     .expect(200)
            );
        })
        .spread(email => assert.strictEqual(email.headers.subject, 'Your password has been changed'));
    });

    it('email verification', function(){
      const address = init.randomName() + '@example.com';
      return init.getIdSiteBearer(applicationId, {cb_uri: callbackUrl})
        .then(function(bearer){
          return BluebirdPromise.join(
                init.getEmailPromise(mailServer, address.toLowerCase()),
                request(init.app).post('/v1/applications/'+applicationId+'/accounts')
                  .set('authorization', 'Bearer '+bearer)
                  .send({
                      email: address,
                      password: 'Aa123456',
                      givenName: init.randomName(),
                      surname: init.randomName()
                  })
                  .expect(200)
            )
            .spread(function(email, res){
                  assert.strictEqual(res.body.status, 'UNVERIFIED');
                  const jwtParam = /\/#\/verify\?jwt=(.*?)\n/.exec(email.body)[1];
                  assert(jwtParam);
                  const tokenId = jwt.decode(jwtParam).sp_token;
                  assert(tokenId);
                  return request(init.app).post('/v1/accounts/emailVerificationTokens/'+tokenId)
                    .set('authorization', 'Bearer '+jwtParam)
                    .expect(200);
              });
        });
    });

    it('Requests with bearer authorization must have a limited scope', function(){
        return init.getIdSiteBearer(applicationId, {cb_uri: callbackUrl})
                .then(function(bearer){
                    return request(init.app).get('/v1/applications/'+applicationId+'/accounts')
                        .set('authorization', 'Bearer '+bearer)
                        .expect(403);
                });
    });

    it('ID site model must be exposed by applications', function(){
        return init.getRequest('applications/'+applicationId+'/idSiteModel')
                .expect(200)
                .then(function(res){
                    assert(res.body.hasOwnProperty('providers'));
                    assert(res.body.hasOwnProperty('passwordPolicy'));
                    assert(res.body.hasOwnProperty('logoUrl'));
                });
    });

    it('Password change', function(){
        return init.getIdSiteBearer(applicationId, {cb_uri: callbackUrl})
                //login
                .then(bearer => request(init.app).post('/v1/applications/'+applicationId+'/loginAttempts')
                        .set('authorization', 'Bearer '+bearer)
                        .send({
                            type: 'basic',
                            value: Buffer.from(init.adminUser+':'+init.adminPassword, 'utf8').toString('base64')
                        })
                        .expect(200)
                )
                .then(res => request(res.header['stormpath-sso-redirect-location']).get('').expect(302))
                .then(res => BluebirdPromise.join(
                            init.getIdSiteJwtRequest(applicationId, {cb_uri: callbackUrl, path: '/#/securitySettings'}),
                            res.header['set-cookie'][0].split(';')[0]
                ))
                //send a a new request to access security settings with the cookie
                .spread((jwtRequest, cookie) =>
                        request(init.app).get('/sso')
                            .query({jwtRequest: jwtRequest})
                            .set('Cookie', cookie)
                            .expect(302)
                )
                .then(res => {
                    const fragmentStart = '/#/securitySettings?jwt=';
                    assert(res.header.location.indexOf(fragmentStart) >= 0);
                    return res.header.location.substring(res.header.location.indexOf(fragmentStart) + fragmentStart.length);
                })
                //this bearer should give access to the /passwordChanges endpoint
                .then(bearer => request(init.app).post('/v1/accounts/'+init.adminUserId+'/passwordChanges')
                            .set('authorization', 'Bearer '+bearer)
                            .send({
                                currentPassword: '123456',
                                newPassword: init.adminPassword
                            })
                            .expect(400)
                )
                //the password change must be refused if the current password is incorrect
                .then(res => {
                    assert.strictEqual(res.body.code, 7100);
                    return request(init.app).post('/v1/accounts/'+init.adminUserId+'/passwordChanges')
                            .set('authorization', res.get('authorization'))
                            .send({
                                currentPassword: init.adminPassword,
                                newPassword: '1'
                            })
                            .expect(400);
                })
                //the password change must be refused if the new password doesn't satisfy password policy
                .then(res => {
                    assert.strictEqual(res.body.code, 2007);
                    return request(init.app).post('/v1/accounts/'+init.adminUserId+'/passwordChanges')
                            .set('authorization', res.get('authorization'))
                            .send({
                                currentPassword: init.adminPassword,
                                newPassword: init.adminPassword
                            })
                            .expect(204);
                })
                //the password can be changed only once
                .then(res => {
                    return request(init.app).post('/v1/accounts/'+init.adminUserId+'/passwordChanges')
                            .set('authorization', res.get('authorization'))
                            .send({
                                currentPassword: init.adminPassword,
                                newPassword: init.adminPassword
                            })
                            .expect(403);
                });
    });
});