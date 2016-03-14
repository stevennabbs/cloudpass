var express = require('express');
var mustacheExpress = require('mustache-express');
var bodyParser = require('body-parser');

exports.new = function(){
    var app = express();
    app.use(bodyParser.urlencoded({extended: true}));
    app.engine('mustache', mustacheExpress());
    app.set('view engine', 'mustache');
    app.set('views', __dirname + '/../../ui/views');
    return app;
};
