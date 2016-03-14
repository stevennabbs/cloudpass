"use strict";

var accountStoreController = require('../helpers/accountStoreController');
var models = require('../../models');

module.exports = accountStoreController(models.group, ['delete']);