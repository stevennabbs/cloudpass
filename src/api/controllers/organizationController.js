"use strict";

var accountStoreController = require('../helpers/accountStoreController');
var models = require('../../models');

var controller = accountStoreController(models.organization, ['delete']);
module.exports = controller;