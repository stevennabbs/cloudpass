"use strict";

var baseController = require('../helpers/baseController');
var models = require('../../models');
var ApiError = require('../../ApiError');

var controller = baseController(models.passwordPolicy, ['create', 'delete']);

controller.getStrength = function(req, res){
  models.passwordPolicy
        .findById(req.swagger.params.id.value)
        .then(function(passwordPolicy){
            ApiError.assert(passwordPolicy, ApiError.NOT_FOUND);
            res.json(passwordPolicy.getStrength());
        })
        .catch(req.next);  
};

controller.setStrength = function(req, res) {
    models.passwordPolicy
        .findById(req.swagger.params.id.value)
        .then(function(passwordPolicy){
             if (passwordPolicy === null) {
                throw ApiError.NOT_FOUND;
            }
            return passwordPolicy.update({strength: req.swagger.params.newAttributes.value});
        })
        .then(function(passwordPolicy){
            res.json(passwordPolicy.getStrength());
        })
        .catch(req.next);  
};
module.exports = controller;