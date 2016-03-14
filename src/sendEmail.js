"use strict";

var config = require('config');
var nodemailer = require('nodemailer');
var BluebirdPromise = require('sequelize').Promise;
var _ = require('lodash');

var templateSettings = {interpolate : /\${([\w\.]+?)}/g};

// create reusable transporter object using SMTP transport
var transporter = nodemailer.createTransport(config.get('email.transport'));
var transporterSendEmail = BluebirdPromise.promisify(transporter.sendMail, {context: transporter});

module.exports  = function(account, directory, template, cpToken, additionalfieldValues){
    var fieldValues = _.merge({account: account}, additionalfieldValues);
    fieldValues.account.directory = directory;
    if(cpToken){
        _.defaults(fieldValues, template.getUrlTokens(cpToken));
    }
    
    var mailOptions = {
        from: template.fromName + '<'+template.fromEmailAddress+'>',
        to: account.email,
        subject: template.subject,
        text: _.template(template.textBody, templateSettings)(fieldValues)
    };
    
    if(config.has('email.bcc')){
        mailOptions.bcc = config.get('email.bcc');
    }
    
    //Add html alternative only if the mime type is text/html
    if(template.mimeType === 'text/html'){
        mailOptions.html = _.template(template.htmlBody, templateSettings)(fieldValues);
    }
    
    return transporterSendEmail(mailOptions)
            .catch(function(e){
                console.error('Could not send email: ', e.stack);
            });
};
