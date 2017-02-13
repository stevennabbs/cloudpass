var assert = require("assert");
var init = require('./init');

describe('Application', function() {
  var applicationId;
  var directoryId;
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
                applicationId = res.body.id;
                directoryId = res.body.directories.items[0].id;
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

  describe('Account Store', function(){
    var otherDirectoryId, groupId;
    it('Mapping', function(){
        //create a directory
        return init.postRequest('directories')
            .send({name: init.randomName()})
            .expect(200)
            .then(function(res){
                //create a group in the directory
                otherDirectoryId = res.body.id;
                return init.postRequest('directories/'+res.body.id+'/groups')
                    .send({name: init.randomName()})
                    .expect(200);
            })
            .then(function(res){
                groupId = res.body.id;
                //map the group & the application
                return init.postRequest('accountStoreMappings')
                        .send({
                            application:{href: '/applications/'+applicationId},
                            accountStore:{href: '/groups/'+groupId},
                            isDefaultAccountStore: true
                        })
                        .expect(200);
            })
            .then(function(res){
                return init.getRequest('applications/'+applicationId)
                    .query({expand: 'directories,groups,defaultAccountStoreMapping,defaultGroupStoreMapping'})
                    .expect(200);
            })
            .then(function(res){
                //the should be one directory & one group
                assert.strictEqual(res.body.directories.size, 1);
                assert.strictEqual(res.body.directories.items[0].id, directoryId);
                assert.strictEqual(res.body.groups.size, 1);
                assert.strictEqual(res.body.groups.items[0].id, groupId);
            });
    });

    it('Account creation', function(){
       return init.postRequest('applications/'+applicationId+'/accounts')
            .query({expand: 'directory,groups'})
            .send({
                email: 'test@example.com',
                password: 'Aa123456',
                givenName: init.randomName(),
                surname: init.randomName()
            })
            .expect(200)
            .then(function(res){
                //the account should be in the same directory as the group, and must be mapped to the group
                assert.strictEqual(res.body.directory.id, otherDirectoryId);
                assert.strictEqual(res.body.groups.size, 1);
                assert.strictEqual(res.body.groups.items[0].id, groupId);
            });
    });

    it('Group creation', function(){
        return init.postRequest('applications/'+applicationId+'/groups')
            .query({expand: 'directory'})
            .send({name: init.randomName()})
            .expect(200)
            .then(function(res){
                assert.strictEqual(res.body.directory.id, directoryId);
            });
    });
  });

  describe('Login attempts', function () {

     it('Must succeed if username and password are correct', function(){
         return init.postRequest('applications/'+applicationId+'/loginAttempts')
                .send({
                    type: 'basic',
                    value: Buffer.from('test@example.com:Aa123456', 'utf8').toString('base64')
                })
                .expect(200)
                .then(function(res){
                    assert(res.body.account);
                    assert(res.body.account.href);
                });
     });

     it('Must fail if username or password are incorrect', function(){
        return init.postRequest('applications/'+applicationId+'/loginAttempts')
                .send({
                    type: 'basic',
                    value: Buffer.from('test@example.com:Aa12345', 'utf8').toString('base64')
                })
                .expect(400)
                .then(function(res){
                    assert.strictEqual(res.body.status, 400);
                    assert.strictEqual(res.body.code, 7100);
                });
     });

     it('Must return the expanded account if requested', function(){
         return init.postRequest('applications/'+applicationId+'/loginAttempts')
                .query({expand: 'account'})
                .send({
                    type: 'basic',
                    value: Buffer.from('test@example.com:Aa123456', 'utf8').toString('base64')
                })
                .expect(200)
                .then(function(res){
                    assert.strictEqual(res.body.email, 'test@example.com');
                });
     });

     it('The specified account store must be taken into account', function(){
        return init.postRequest('applications/'+applicationId+'/loginAttempts')
                .send({
                    type: 'basic',
                    value: Buffer.from('test@example.com:Aa12345', 'utf8').toString('base64'),
                    accountStore: {
                        href: '/organizations/6cacc65f-37e8-4b28-91ae-de031a695d43'
                    }
                })
                .expect(400)
                .then(function(res){
                    //we should get an error because this organization does not exists
                    assert.strictEqual(res.body.status, 400);
                    assert.strictEqual(res.body.code, 2014);
                });
     });
  });
});