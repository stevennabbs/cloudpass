"use strict";

var _ =require('lodash');
var accountStoreController = require('../helpers/accountStoreController');
var models = require('../../models');

var controller = accountStoreController(models.organization, ['delete']);
controller.getIdSiteModel = _.partial(controller.getComputedSubResource, 'getIdSiteModel');
module.exports = controller;