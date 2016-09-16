var assert = require("assert");
var init = require('./init');
var BluebirdPromise = require('sequelize').Promise;
var readFile = BluebirdPromise.promisify(require("fs").readFile);
var request = require('supertest-as-promised');
var url = require('url');

describe('SAML', function(){
    var idpSsoLoginUrl = 'http://idp.example.com/login';
    var idpSsoLogoutUrl = 'http://idp.example.com/logout';
    var directoryId;
    describe('SAML directory creation', function(){
        it('specifying providerId = "saml" should creatte a SAML directory', function(){
            return readFile(__dirname + '/resources/saml/idp.crt', 'utf8')
                .then(function(idpCertificate){
                    return init.postRequest('directories')
                            .query({expand: 'provider'})
                            .send({
                                name: 'SAML directory',
                                provider: {
                                    providerId: 'saml',
                                    ssoLoginUrl: idpSsoLoginUrl,
                                    ssoLogoutUrl: idpSsoLogoutUrl,
                                    encodedX509SigningCert: idpCertificate
                                }
                            })
                            .expect(200)
                            .then(function (res) {
                                directoryId = res.body.id;
                                assert(res.body.provider);
                                assert.strictEqual(res.body.provider.providerId, 'saml');
                                assert.strictEqual(res.body.provider.ssoLoginUrl, idpSsoLoginUrl);
                                assert.strictEqual(res.body.provider.ssoLogoutUrl, idpSsoLogoutUrl);
                                assert.strictEqual(res.body.provider.encodedX509SigningCert, idpCertificate);
                            });;
                });
        });
        
    });
    
    describe('SAML Service Provider Metadata', function(){
        var samlServiceProviderMetadataId;
        before(function(){
            return init.getRequest('directories/' + directoryId + '/provider')
                .query({expand: 'samlServiceProviderMetadata'})
                .expect(200)
                .then(function(res){
                    samlServiceProviderMetadataId = res.body.samlServiceProviderMetadata.id;
                });
        });
        
        it('Service Provider Metadata should be returned in XML format by default', function(){
            return init.getRequest('samlServiceProviderMetadatas/'+samlServiceProviderMetadataId)
                .accept('*.*')
                .expect(200)
                .then(function(res){
                    assert.strictEqual(res.type, 'application/xml');
                });
        });
        
        it('Service Provider Metadata should be returned in JSON format if requested', function(){
            return init.getRequest('samlServiceProviderMetadatas/'+samlServiceProviderMetadataId)
                .accept('json')
                .expect(200)
                .then(function(res){
                    assert.strictEqual(res.type, 'application/json');
                    assert(res.body.entityId);
                    assert(res.body.x509SigningCert);
                });
        });
    });
    
    describe('Attribute Statement Mapping Rules', function(){
        var attributeStatementMappingRulesId;
        before(function(){
            return init.getRequest('directories/' + directoryId + '/provider')
                .query({expand: 'attributeStatementMappingRules'})
                .expect(200)
                .then(function(res){
                    attributeStatementMappingRulesId = res.body.attributeStatementMappingRules.id;
                });
        });
        
        it('Rules should be initially empty', function(){
            return init.getRequest('attributeStatementMappingRules/'+attributeStatementMappingRulesId)
                    .expect(200)
                    .then(function(res){
                        assert.deepStrictEqual(res.body.items, []);
                    });
        });
        
        it('Attributes can be mapped to Account and CustomData fields', function(){
            var mappingItems = [
                {
                    name: "firstName",
                    accountAttributes: ['givenName']
                },
                {
                    name: "lastName",
                    accountAttributes: ['surname']
                },
                {
                    name: "company",
                    accountAttributes: ['customData.company']
                }
            ];
            return init.postRequest('attributeStatementMappingRules/'+attributeStatementMappingRulesId)
                    .send({items: mappingItems})
                    .expect(200)
                    .then(function(res){
                        assert.deepStrictEqual(res.body.items, mappingItems);
                    });
        });
        
        it('Attributes cannot be mapped unexistent Account fields', function(){
            return init.postRequest('attributeStatementMappingRules/'+attributeStatementMappingRulesId)
                    .send({items: [{
                        name:"firstName",
                        accountAttributes: ['foo']
                    }]})
                    .expect(400);
        });
    });
    
    describe('SAML application', function(){
        var applicationId;
        before(function(){
            //create an application an map it the the SAML directory
            return init.postRequest('applications')
                .send({name: 'SAML application'})
                .expect(200)
                .then(function(res){
                    applicationId = res.body.id;
                    return init.postRequest('accountStoreMappings')
                            .send({
                                application:{href: '/applications/'+applicationId},
                                accountStore:{href: '/directories/'+directoryId}
                            })
                            .expect(200);
                });
        });
       
        it('application should have a SAML policy', function(){
           return init.getRequest('samlPolicies/'+applicationId)
                .expect(200)
                .then(function(res){
                    assert(res.body.serviceProvider);
                });
        });
        
        it('application should have a SAML Service Provider', function(){
           return init.getRequest('samlServiceProviders/'+applicationId)
                .expect(200)
                .then(function(res){
                    assert(res.body.ssoInitiationEndpoint);
                    assert(res.body.defaultRelayStates);
                });
        });
        
        it('ID site model should have a SAML provider', function(){
            return init.getRequest('applications/'+applicationId+'/idSiteModel')
                .expect(200)
                .then(function(res){
                    assert.strictEqual(res.body.providers.length, 1);
                    assert.strictEqual(res.body.providers[0].providerId, 'saml');
                });
        });
        
        it('default relay state generation', function(){
            return init.postRequest('samlServiceProviders/'+applicationId+'/defaultRelayStates') 
                .send({
                    callbackUri: 'http://www.example.com/callback',
                    state: 'foo'
                })
                .expect(200)
                .then(function(res){
                    assert(res.body.defaultRelayState);
                });
        });
        
        it('SAML authentication via ID Site', function(){
            var callbackUrl = 'http://www.example.com/callback';
            return init.getIdSiteBearer(applicationId, callbackUrl)
                .then(function(bearer){
                     return request(init.app).get('/v1/applications/'+applicationId+'/saml/sso/idpRedirect')
                        .set('authorization', 'Bearer '+bearer)
                        .expect(200)
                        .toPromise();
                })
                .then(function(res){
                    var redirectLocation = res.header['stormpath-sso-redirect-location'];
                    assert(redirectLocation);
                    assert(redirectLocation.startsWith(idpSsoLoginUrl));
                    var parsed = url.parse(redirectLocation, true);
                    assert(parsed.query.SAMLRequest);
                    assert(parsed.query.RelayState);
                    return parsed.query.RelayState;
                })
                .then(function(relayState){
                    return readFile(__dirname + '/resources/saml/idpResponse', 'utf8')
                        .then(function(samlResponse){
                            return request(init.app)
                                .post('/v1/directories/'+directoryId+'/saml/sso/post')
                                .send('SAMLResponse='+encodeURIComponent(samlResponse))
                                .send('RelayState='+encodeURIComponent(relayState))
                                .expect(302)
                                .toPromise();
                        });
                    
                })
                .then(function(res){
                    //cloudpass should redirect to its /sso enpoint with a jwtResponse query param to set a cookie
                    var redirectLocationStart = '../../../../../sso';
                    assert(res.headers.location.startsWith(redirectLocationStart));
                    return request(init.app).get('/sso' + res.headers.location.substring(redirectLocationStart.length))
                        .expect(302)
                        .toPromise();
                })
                .then(function(res){
                    //now we should be redirected to the callback URL
                    assert(res.header.location.startsWith(callbackUrl+'?jwtResponse='));
                    //an account should have been created from the SAML assertions
                    return init.getRequest('applications/'+applicationId+'/accounts')
                            .query({expand: 'customData'})
                            .expect(200)
                            .toPromise();
                })
                .then(function(res){
                    assert.strictEqual(res.body.size, 1);
                    assert.strictEqual(res.body.items[0].email, 'test-saml@example.com');
                    assert.strictEqual(res.body.items[0].givenName, 'John');
                    assert.strictEqual(res.body.items[0].surname, 'Doe');
                    assert.strictEqual(res.body.items[0].customData.company, 'some-company');
                });
        });
        
    });
    
});