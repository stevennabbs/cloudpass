var assert = require('assert');
var url = require('url');
var init = require('./init');
var BluebirdPromise = require('sequelize').Promise;
var request = require('supertest-as-promised');

describe('admin invitation', function(){
    var mailServer;
    before(function () {
       mailServer = init.getMailServer(); 
    });
    
    after(function () {
        mailServer.stop();
    });
    
    it('invitation workflow', function(){
        var invitedEmail = 'invited@example.com';
        
        return BluebirdPromise.join(
                    // send an invitation email
                    init.getEmailPromise(mailServer, invitedEmail),
                    init.postRequest('tenants/'+init.apiKey.tenantId+'/invitationEmails')
                        .send({
                            to: [invitedEmail],
                            subject: 'invitation',
                            textBody: '${url}',
                            linkPath: 'adminInvitation.html'
                        })
                        .expect(204)
                        .toPromise()
                )
                .spread(function(email){
                    //consume the invitation
                    return request(init.app).get('/adminInvitation'+url.parse(email.body).search)
                            .expect(200)
                            .toPromise();
                })
                .then(function(res){
                    assert(res.body.id);
                    assert(res.body.fromAccount.fullName);
                    assert(res.body.tenant.key);
                    assert.strictEqual(res.body.email, invitedEmail);
                    return request(init.app).post('/adminInvitation')
                        .send('invitationId='+res.body.id)
                        .send('givenName=test')
                        .send('surname=test')
                        .send('password=Aa123456')
                        .expect(204)
                        .toPromise();
                })
                .then(function(){
                    //the new admin should be able to login
                    return request(init.app)
                        .post('/login')
                        .send('tenantNameKey=test-tenant')
                        .send('email='+invitedEmail)
                        .send('password=Aa123456')
                        .expect(204)
                        .toPromise();
                })
                .then(function(res){
                    assert(res.header['set-cookie']);
                });
    });
    
    it('invalid invitations should be rejected', function(){
        return request(init.app)
                .post('/adminInvitation')
                .send('invitationId=invalidInvitation')
                .send('givenName=test')
                .send('surname=test')
                .send('password=Aa123456')
                .expect(400);
    });
});