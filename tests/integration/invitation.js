"use strict";

const assert = require('assert');
const BluebirdPromise = require('sequelize').Promise;
var jwt = require('jsonwebtoken');
var request = require('supertest');
const init = require('./init');

describe('invitation', () => {
  let mailServer;
  let applicationId;
  let invitationId;
  const invitedEmail = init.randomName()+'@example.com';
  const callbackUri = 'https://example.com/callback';

  before(() => {
     //start the SMTP server
     mailServer = init.getMailServer();
     //get the admin application
     return init.getRequest('tenants/'+init.apiKey.tenantId+'/applications')
        .query({ name: 'Cloudpass', limit: 1, expand: 'invitationPolicy'})
        .expect(200)
        .then(function(res){
            applicationId = res.body.items[0].id;
            //enable invitation emails
            return init.postRequest('invitationPolicies/'+res.body.items[0].invitationPolicy.id)
                      .send({invitationEmailStatus:"ENABLED"})
                      .expect(200);
        })
  });

  after(() => {
    mailServer.stop();
  });

  it('creation', () =>
    //if no callbackUri is specified, the link in the email must redirect to the address specified in the email template
    BluebirdPromise.join(
      init.getEmailPromise(mailServer, invitedEmail),
      init.postRequest('invitations')
        .send({
          email: invitedEmail,
          application: {href: '/applications/'+applicationId}
        })
        .expect(200)
    ).spread((email, res) => {
      invitationId = res.body.id;
      assert.strictEqual(email.headers.subject, 'Invitation');
      assert(email.body.indexOf('https://change.me.example.com?cpToken='+invitationId) >= 0);
    })
  );

  it('update', () =>
    //if a callbackUri is specified, the link in the email must redirect to the ID site
    BluebirdPromise.join(
      init.getEmailPromise(mailServer, invitedEmail),
      init.postRequest('invitations/'+invitationId)
        .send({callbackUri})
        .expect(200)
    ).spread((email, res) => {
      assert.strictEqual(email.headers.subject, 'Invitation');
      const jwtParam = /\/#\/\?jwt=(.*?)\n/.exec(email.body)[1];
      assert(jwtParam);
      const decodedJwt = jwt.decode(jwtParam);
      assert.strictEqual(decodedJwt.inv_href, '/invitations/'+invitationId);
      assert.strictEqual(decodedJwt.email, invitedEmail);
      //login with this token
      return request(init.app).post('/v1/applications/'+applicationId+'/loginAttempts')
                        .set('authorization', 'Bearer '+jwtParam)
                        .send({
                            type: 'basic',
                            value: Buffer.from(init.adminUser+':'+init.adminPassword, 'utf8').toString('base64')
                        })
                        .expect(200);
    })
    .then(res => {
      assert(res.header['stormpath-sso-redirect-location']);
      return request(init.app).get(res.header['stormpath-sso-redirect-location'])
              .expect(302);
    })
    .then((res) => {
      assert(res.header.location);
      const locationStart = callbackUri+'?jwtResponse=';
      assert(res.header.location.startsWith(locationStart));
      const jwtResponse = res.header.location.substring(locationStart.length);
      assert.strictEqual(jwt.decode(jwtResponse).inv_href, '/invitations/'+invitationId);
   })
  );

  it('delete', () => init.deleteRequest('invitations/'+invitationId).expect(204));

});