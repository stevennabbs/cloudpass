"use strict";

var BluebirdPromise = require('sequelize').Promise;
var _ = require('lodash');
var Optional = require('optional-js');
var config = require('config');
var baseController = require('../helpers/baseController');
var ApiError = require('../../ApiError');
var models = require('../../models');
var email = require('../../helpers/email');

var invitationBaseUrl = Optional.ofNullable(config.get('server.rootUrl')).orElseGet(function(){return 'http://'+require('os').hostname()+':'+config.get('server.port');}) +'/ui/';
var invitationSender =  config.has('email.transport.options.auth.user')?config.get('email.transport.options.auth.user'):'support@cloudpass.com';

//a user can only access its own tenant
//check if the requested tenant is the right one before making any request
var controller = _.mapValues(
      baseController(models.tenant),
      function(baseAction){
          return function (req, res) {
              ApiError.assert(req.swagger.params.id.value === req.user.tenantId, ApiError.FORBIDDEN);
              baseAction(req, res);
          };
      });

controller.getCurrent = function (req, res) {
    res.status(302)
            .location(
                Optional.ofNullable(config.get('server.rootUrl'))
                    .map(_.method('concat', '/v1/tenants/', req.user.tenantId))
                    .orElse(req.user.tenantId)
            )
            .json();
};

controller.inviteAdmin = function(req, res) {
    var invitationParams = req.swagger.params.invitation.value;
    var emailTemplate = models.emailTemplate.build({
        fromEmailAddress: invitationSender,
        fromName: 'Cloudpass support',
        subject: invitationParams.subject,
        textBody: invitationParams.textBody,
        mimeType: 'text/plain',
        linkBaseUrl: invitationBaseUrl + invitationParams.linkPath
    });
    BluebirdPromise.all(
        _.map(
            invitationParams.to,
            function(emailAddress){
                return models.adminInvitation.create({
                        email: emailAddress,
                        tenantId: req.user.tenantId,
                        fromAccountId: req.user.accountId
                    })
                    .then(function(adminInvitation){
                        //asynchronously send an email with the token
                        email.send({email: emailAddress}, null, emailTemplate, adminInvitation.id);
                    });
            }
        )
    )
    .then(function(){
        res.status(204).json();
    })
    .catch(req.next);
};

module.exports = controller;

