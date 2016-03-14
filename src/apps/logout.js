var express = require('express');

var app = express();
app.get('/', function(req, res){
    res.clearCookie('sessionToken', {path: '/v1'})
            .status(204)
            .end();
});
module.exports = app;