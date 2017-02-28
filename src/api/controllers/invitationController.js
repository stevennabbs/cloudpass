"use strict";

var _ = require('lodash');
var BluebirdPromise = require('sequelize').Promise;
var signJwt = BluebirdPromise.promisify(require('jsonwebtoken').sign);
var randomstring = require("randomstring");
var Optional = require("optional-js");
var baseController = require('../helpers/baseController');
var controllerHelper = require('../helpers/controllerHelper');
var scopeHelper = require('../../helpers/scopeHelper');
var email = require('../../helpers/email');
var models = require('../../models');
var ApiError = require('../../ApiError');

var controller = baseController(models.invitation);


function sendEmail(invitation, apiKey) {
  return invitation.getApplication({
          include: [{
            model: models.invitationPolicy,
            include: [{
              model: models.emailTemplate,
              as: 'invitationEmailTemplates'
            }]
          }]
        })
        .then(application => {
          ApiError.assert(application.invitationPolicy.invitationEmailStatus === 'ENABLED', ApiError, 400, 400, 'the invitation workflow is not enabled');
          return BluebirdPromise.resolve(
            //if a callbackUri is specified, the link in the email must send the user on ID site
            Optional.ofNullable(invitation.callbackUri)
              .map(callbackUri => BluebirdPromise.join(
                                      signJwt(
                                      {
                                        init_jti:  randomstring.generate(20),
                                        scope: scopeHelper.getIdSiteScope(application),
                                        app_href: application.href,
                                        cb_uri: callbackUri,
                                        ash: application.href,
                                        inv_id: invitation.id,
                                        email: invitation.email
                                      },
                                      apiKey.secret,
                                      {
                                        subject: apiKey.id,
                                        audience: 'idSite',
                                      }
                                    ),
                                    models.idSite.findOne({attributes: ['url']}).get('url')
                                  )
                                  .spread((jwt, idSiteUrl) => ({url: idSiteUrl + '/#/?jwt=' + jwt}))
              )
              .orElseGet(_.stubObject)
            )
            .then(placeHolderValues =>
                  //add applications, organization & fromAccount placeholders
                  BluebirdPromise.join(
                    Optional.ofNullable(invitation.organizationId).map(() => invitation.getOrganization({attributes: ['name']})).orElseGet(_.stubObject),
                    Optional.ofNullable(invitation.fromAccountId).map(() => invitation.getFromAccount({attributes: ['givenName', 'surname', 'username', 'email']})).orElseGet(_.stubObject)
                  )
                  .spread((organization, fromAccount) => {
                    placeHolderValues.application = _.pick(application, ['name']);
                    placeHolderValues.organization = _.pick(organization, ['name']);
                    placeHolderValues.fromAccount = _.pick(fromAccount, ['givenName', 'fullName', 'surname', 'username', 'email']);
                    email.send(
                      {email: invitation.email},
                      null,
                      application.invitationPolicy.invitationEmailTemplates[0],
                      invitation.id,
                      placeHolderValues
                    );
                  })
            );
        });
}

controller.create = function(req, res) {
  return controllerHelper.queryAndExpand(
    () => controllerHelper.create(
            models.invitation,
            {tenantId: req.user.tenantId},
            req.swagger.params.attributes.value
          )
          .tap(invitation => sendEmail(invitation, req.user)),
    req,
    res,
    true
  );
};

controller.update = function(req, res){
  return controllerHelper.queryAndExpand(
    () => controllerHelper.update(
            models.invitation,
            req.swagger.params.id.value,
            req.swagger.params.newAttributes.value
          )
          .tap(invitation => sendEmail(invitation, req.user)),
    req,
    res,
    true
 );
};

module.exports = controller;