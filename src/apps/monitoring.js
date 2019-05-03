'use strict';

const _ = require('lodash');
const Health = require('health-checkup');
const appInfo = require("node-appinfo")();
const express = require('express');
const models = require('../models');
const ssacl = require('ssacl');


Health.addCheck('database', () => models.sequelize.authenticate({actor: new ssacl.Omnipotent()}));


const app = express();
app.disable('x-powered-by');

app.get('/health', (req, res) =>
    Health.checkup()
        .then(report => {
            res.status(_.find(report, _.matchesProperty('is_healthy', false)) ? 503 : 200)
                .json(report);
            return null;
        })
        .catch(req.next));

app.get('/version', (req, res) => res.json(appInfo.version));

module.exports = app;
