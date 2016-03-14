"use strict";

var accountStoreMappingController = require('../helpers/accountStoreMappingController');
var models = require('../../models');

module.exports = accountStoreMappingController(models.organizationAccountStoreMapping);