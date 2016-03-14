var assert = require("assert");
var init = require('./init');

describe('Application', function() {
  describe('Creation', function () {
    it('POST to /applications with createDirectory=true should create an application and a directory with the same name', function () {
        var name = init.randomName();
        return init.postRequest('applications')
            .query({ createDirectory: 'true', expand: 'directories'})
            .send({name: name})
            .expect(200)
            .then(function(res){
                assert(res.body.id);
                assert.strictEqual(res.body.name, name);
                assert.strictEqual(res.body.directories.size, 1);
                assert.strictEqual(res.body.directories.items[0].name, name);
            });
    });
    
    it('POST to /applications with createDirectory=*name* should create an application and a directory with the provided name', function () {
        var applicationName = init.randomName();
        var directoryName = init.randomName();
        return init.postRequest('applications')
            .query({ createDirectory: directoryName, expand: 'directories'})
            .send({name: applicationName})
            .expect(200)
            .then(function(res){
                assert(res.body.id);
                assert.strictEqual(res.body.name, applicationName);
                assert.strictEqual(res.body.directories.size, 1);
                assert.strictEqual(res.body.directories.items[0].name, directoryName);
            });
    });
    
    it('POST to /applications without createDirectory parameter should create an application but no directory', function () {
        var name = init.randomName();
        return init.postRequest('applications')
            .query({expand: 'directories'})
            .send({name: name})
            .expect(200)
            .then(function(res){
                assert(res.body.id);
                assert.strictEqual(res.body.name, name);
                assert.strictEqual(res.body.directories.size, 0);
            });
    });
    
  });
  
  describe('Login attempts', function () {
     var application;
     before(function(){
        return init.getRequest('tenants/'+init.apiKey.tenantId+'/applications')
            .query({ name: 'Cloudpass', limit: 1})
            .expect(200)
            .then(function(res){
                application = res.body.items[0];
            });
     });
     
     it('Login attempts must succeed if username and password are correct', function(){
         return init.postRequest('applications/'+application.id+'/loginAttempts')
                .send({
                    type: 'basic',
                    value: new Buffer('test@example.com:Aa123456', 'utf8').toString('base64')
                })
                .expect(200)
                .then(function(res){
                    assert(res.body.account);
                    assert(res.body.account.href);
                });
     });
     
     it('Login attempt must fail if username or password are incorrect', function(){
         return init.postRequest('applications/'+application.id+'/loginAttempts')
                .send({
                    type: 'basic',
                    value: new Buffer('test@example.com:Aa12345', 'utf8').toString('base64')
                })
                .expect(400)
                .then(function(res){
                    assert.strictEqual(res.body.status, 400);
                    assert.strictEqual(res.body.code, 7100);
                });
     });
     
     it('Login attempt must return the expanded account if requested', function(){
         return init.postRequest('applications/'+application.id+'/loginAttempts')
                .query({ createDirectory: 'true', expand: 'account'})
                .send({
                    type: 'basic',
                    value: new Buffer('test@example.com:Aa123456', 'utf8').toString('base64')
                })
                .expect(200)
                .then(function(res){
                    assert.strictEqual(res.body.email, 'test@example.com');
                    assert.strictEqual(res.body.givenName, 'test');
                    assert.strictEqual(res.body.surname, 'test');
                });
     });
  });
});