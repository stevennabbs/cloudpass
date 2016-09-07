'use strict';

var ssaclCls = require('continuation-local-storage').createNamespace('sequelize-cls');
var express = require('express');
var cluster = require('cluster');
var models = require('./models');
var numCPUs = require('os').cpus().length;
var config = require('config');
var ssacl = require('ssacl');
var randomstring = require("randomstring");
var loginApp = require('./apps/login');
var logoutApp = require('./apps/logout');
var restApiApp = require('./apps/restApi');
var uiApp = require('./apps/ui');
var registrationApp = require('./apps/registration');
var adminInvitationApp = require('./apps/adminInvitation');
var ssoApp = require('./apps/sso');
var _ = require('lodash');

if(cluster.isMaster){
    //run pending migrations and fork clusters
    var secret = randomstring.generate(50);
    module.exports = models
        .migrate()
        .then(function(){
            if(config.get('server.clustering') && numCPUs > 1){
                return _.times(Math.min(numCPUs, 4), cluster.fork.bind(cluster, {secret: secret}));
            } else {
                return startServer(secret);
            }
        });
} else {
    module.exports = startServer(process.env.secret);
}

function startServer(secret){
    //enable ACL
    models.useSsacl(ssacl, ssaclCls);
    
    var app = express();
    app.set('secret', secret);
    app.set('ssaclCls', ssaclCls);
    app.get('/', function(req, res){
        res.status(302).location('ui/').end();
    });
    app.use('/login', loginApp);
    app.use('/logout', logoutApp);
    app.use('/ui', uiApp);
    app.use('/registration', registrationApp);
    app.use('/adminInvitation', adminInvitationApp);
    app.use('/sso', ssoApp);
    return restApiApp(secret).then(function(apiApp){
        app.use('/v1', apiApp);
        //start the server
        return app.listen(config.get('server.port'));
    });
}