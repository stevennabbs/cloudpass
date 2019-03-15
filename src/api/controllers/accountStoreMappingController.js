"use strict";

const baseController = require('../helpers/baseController');
const models = require('../../models');

module.exports = baseController(models.accountStoreMapping, ['create', 'update', 'delete']);