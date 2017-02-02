'use strict';

var ssaclCls = require('continuation-local-storage').createNamespace('sequelize-cls');
var express = require('express');
var cluster = require('cluster');
var cookieParser = require('cookie-parser');
var numCPUs = require('os').cpus().length;
var config = require('config');
var ssacl = require('ssacl');
var randomstring = require('randomstring');
var _ = require('lodash');
var loadLoggingConfig = require('sequelize').Promise.promisify(require('winston-config').fromJson);

module.exports = loadLoggingConfig(config.get('logging'))
    .then(function(){
        if(cluster.isMaster){
            //run pending migrations and fork clusters
            var secret = config.get('server.secret') || randomstring.generate(50);
            return require('./models').migrate()
                .then(function(){
                    if(config.get('server.clustering') && numCPUs > 1){
                        return _.times(Math.min(numCPUs, 4), cluster.fork.bind(cluster, {secret: secret}));
                    } else {
                        return startServers(secret);
                    }
                });
        } else {
            return startServers(process.env.secret);
        }
});

function startServers(secret){
    //enable ACL
    require('./models').useSsacl(ssacl, ssaclCls);

    //start monitoring app
    require('./apps/monitoring').listen(config.get('server.monitoringPort'));

    //load functional components
    var app = express();
    app.set('secret', secret);
    app.use(cookieParser(secret));
    app.set('ssaclCls', ssaclCls);
    app.get('/', function(req, res){
        res.status(302).location('ui/').end();
    });
    app.use('/login', require('./apps/login'));
    app.use('/logout', require('./apps/logout'));
    app.use('/ui', require('./apps/ui'));
    app.use('/registration', require('./apps/registration'));
    app.use('/adminInvitation', require('./apps/adminInvitation'));
    app.use('/sso', require('./apps/sso'));

    return require('./apps/restApi')(secret)
        .then(function(apiApp){
          app.use('/v1', apiApp);
          //start the server
          return app.listen(config.get('server.port'));
       });
}