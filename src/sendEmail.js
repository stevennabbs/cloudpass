"use strict";

var config = require('config');
var nodemailer = require('nodemailer');
var BluebirdPromise = require('sequelize').Promise;
var _ = require('lodash');
var Optional = require('optional-js');

var templateSettings = {interpolate : /\${([\w\.]+?)}/g};
var accountFields = ['givenName', 'surname', 'fullName', 'username', 'email', 'directory'];
var directoryFields = ['name'];

// create reusable transporter object
var transportName = config.get('email.transport.name');
var transportOptions = config.get('email.transport.options');
var transporter = nodemailer.createTransport(
    Optional.ofNullable(transportName)
        .map(function(pluginName){return require(pluginName)(transportOptions);})
        .orElse(transportOptions)
);
var transporterSendEmail = BluebirdPromise.promisify(transporter.sendMail, {context: transporter});

function getMandrillFields(mandrillTemplate, placeHolderValues){
    return {
        //subject, content & from fields are provided by the template
        subject: null,
        text: null,
        html: null,
        from: null,
        mandrillOptions: {
            template_name: mandrillTemplate,
            template_content: [],
            message:{
                global_merge_vars: _(placeHolderValues)
                                    .toPairs()
                                    .map(_.partial(_.zipObject, ['name', 'content']))
                                    .value()
            }
        }
    };
}

module.exports  = function(account, directory, template, cpToken, additionalPlaceHolderValues){
    var placeHolderValues = _.merge(
        //selection of account & directory fields
        {account: _.pick(_.defaults(account, {directory: _.pick(directory, directoryFields)}), accountFields)},
        //token related fields (url, name value pair...)
        Optional.ofNullable(cpToken).map(_.bindKey(template, 'getUrlTokens')).orElseGet(_.stubObject),
        //custom fields
        additionalPlaceHolderValues
    );
    
    var emailFields = _.defaults
    (
        //configuration fields
        config.get('email.fields'),
        //mandrill fields
        Optional.ofNullable(template.mandrillTemplate)
            .map(_.partial(getMandrillFields, _, placeHolderValues))
            .orElseGet(_.stubObject),
        //template fields
        {
            from: template.fromName + '<'+template.fromEmailAddress+'>',
            to: account.email,
            subject: template.subject,
            text: _.template(template.textBody, templateSettings)(placeHolderValues)
        },
        //Add html alternative only if the mime type is text/html
        Optional.of(template)
            .filter(_.flow(_.property('mimeType'), _.partial(_.eq, 'text/html')))
            .map(function(t){
               return {html: _.template(t.htmlBody, templateSettings)(placeHolderValues)};
            })
            .orElseGet(_.stubObject)
    );
    
    return transporterSendEmail(emailFields)
            .catch(function(e){
                console.error('Could not send email: ', e.stack);
            });
};
