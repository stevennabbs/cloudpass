"use strict";

var fs = require("fs");
var path = require("path");
var config = require('config');
var Sequelize = require('sequelize');
var _ = require('lodash');
var Umzug = require('umzug');
var Optional = require('optional-js');
var winston = require('winston');


var persistenceOptions = _.merge(
    {
        define: {
            updatedAt: 'modifiedAt',
            //add href to all resources
            getterMethods: {
                href: function () {
                    return this.constructor.getHref(this.id);
                }
            }
        },
        //remove the last argument passed to the logging function (which is an option object)
        logging: (...args) => winston.loggers.get('sql').debug(..._.initial(args))
    },
    config.get('persistence.options')
);

var sequelize = new Sequelize(config.persistence.database, config.persistence.username, config.persistence.password, persistenceOptions);

//convenience method to start a transaction only if none is already started
sequelize.requireTransaction = function(query){
    return Optional.ofNullable(Sequelize.cls.get('transaction'))
            .map(query)
            .orElseGet(() => this.transaction({isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.REPEATABLE_READ}, query));
};

//default Model.count is not working with SSACL (see https://github.com/pumpupapp/ssacl/issues/4)
Sequelize.Model.count = function(options){
    return this.findAll(
            _.defaults(
                {
                    attributes: [[sequelize.fn('COUNT', sequelize.fn('DISTINCT', sequelize.col(this.name+'.'+this.primaryKeyAttribute))), 'count']],
                    raw: true,
                    plain: true
                },
                _.omit(options, ['offset', 'limit', 'order', 'attributes'])
            )
        )
        .get('count')
        .then(parseInt);
};

Sequelize.Model.findAndCountAll = function(options){
    var self = this;
    return this.sequelize.requireTransaction(function(){
        return self.sequelize.Promise.join(
            self.count(options),
            self.findAll(options)
        );
    })
    .spread(function(count, rows){
        return {count: count, rows: rows};
    });
};

//load all models in the folder
fs
    .readdirSync(__dirname)
    .filter(function (file) {
        return fs.statSync(path.join(__dirname, file)).isFile() && file !== "index.js";
    })
    .forEach(function (file) {
        var model = sequelize.import(path.join(__dirname, file));
        exports[model.name] = model;
    });


// set up the associations between models
_(sequelize.models)
        .values()
        .filter(function(m){return m.associate;})
        .forEach(function(m){m.associate(sequelize.models);});

//post-association hooks
_(sequelize.models)
        .values()
        .filter(function(m){return m.afterAssociate;})
        .forEach(function(m){m.afterAssociate(sequelize.models);});

exports.migrate = function(){
    return new Umzug({
        storage: 'sequelize',
        storageOptions: {
            sequelize: sequelize,
            modelName: 'completedMigrations'
        },
        migrations:{
            params: [ sequelize.getQueryInterface(), Sequelize, sequelize.models ],
            pattern: /\.js$/
        }
    })
    .up();
};

exports.useSsacl = function(ssacl, cls){
    _(sequelize.models)
            .values()
            .filter(_.property('aclAttribute'))
            .forEach(model => {
                ssacl(
                    model,
                    {
                        cls: cls,
                        read: {attribute: model.aclAttribute},
                        write: {attribute: model.aclAttribute}
                    },
                    require('sequelize')
                );
            });
};

exports.sequelize = sequelize;