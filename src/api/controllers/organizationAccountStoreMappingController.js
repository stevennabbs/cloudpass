"use strict";

var baseController = require('../helpers/baseController');
var models = require('../../models');

module.exports = baseController(models.organizationAccountStoreMapping, ['create', 'update', 'delete']);