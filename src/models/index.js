"use strict";

var fs = require("fs");
var path = require("path");
var config = require('config');
var Sequelize = require('sequelize');
var _ = require('lodash');
var Umzug = require('umzug');
var Optional = require('optional-js');
var ApiError = require('../ApiError');
var hrefHelper = require('./helpers/hrefHelper');
var winston = require('winston');


var persistenceOptions = _.merge(
    {
        define: {
            updatedAt: 'modifiedAt',
            //add href to all resources
            getterMethods: {
                href: function () {
                    return this.Model.getHref(this.id);
                }
            },
            classMethods: {
                getHref: function (id) {
                    return  hrefHelper.baseUrl + this.options.name.plural + '/' + id;
                },
               getAclAttribute: function(){
                   return 'tenantId';
               },
               getSearchableAttributes: function(){
                    return [];  
               },
               getSettableAttributes: function(){
                    return this.getSearchableAttributes();
               },
               isCustomizable: function(){
                    return false;  
               },
               associatePriority: function(){
                   return 0;
               },
               fromJSON: function(object){
                   return _.transform(
                        object,
                        function(instance, v, k){
                            if(v.href){
                                //turn hrefs into instances
                                var refInstance = resolveHref(v.href);
                                ApiError.assert(refInstance, ApiError, 400, 2002, '%s href has an invalid value', k);
                                //if the object corresponds to an association, set the corresponding foreign key
                                if(this.associations[k]){
                                    instance.set(this.associations[k].foreignKey, refInstance.id);
                                } else {
                                    instance.set(k, refInstance);
                                }
                            } else {
                                instance.set(k, v);
                            }
                        }.bind(this),
                        this.build({}));
               },
               addFindAndCount: function(target, transformOptions){
                   //pseudo association defined by custom accessors
                   var accessorTypes = {get: 'findAll', count: 'count'};
                   _.set(
                        this,
                        'customAssociations.'+target.options.name.plural,
                        {
                            target: target,
                            associationType: 'hasMany',
                            accessors: _.mapValues(accessorTypes, function(v, k){return k+_.upperFirst(target.options.name.plural);})
                        }
                   );
                   Object.keys(accessorTypes).forEach(function(accessorType){
                       this.Instance.prototype[this.customAssociations[target.options.name.plural].accessors[accessorType]] = function(options){
                           return target[accessorTypes[accessorType]](transformOptions.call(this, options));
                       };
                   }.bind(this));
               }
            },
            //override toJSON
            instanceMethods: {
                toJSON: function () {
                    //"clean" the object to not expand unwanted associations
                    this.dataValues = _.pick(this.dataValues, _.keys(this.Model.attributes));
                    var values = this.get();
                    [this.Model.associations, this.Model.customAssociations].forEach(function(associations){
                        _.forOwn(
                        associations,
                        function (association, associationName) {
                            if(!values[associationName]){
                                if(association.associationType === 'BelongsTo'){
                                    values[associationName] =
                                            Optional.ofNullable(this[association.foreignKey])
                                                .map(function(fk){return {'href': association.target.getHref(fk, this.id)};}.bind(this))
                                                .orElse(null);
                                } else {
                                    values[associationName] = {'href': this.href + "/" + associationName};
                                }
                            }
                        }.bind(this));
                    }.bind(this));
                    return values;
                }
            }
        },
        logging: winston.loggers.get('sql').info
    },
    config.get('persistence.options')
);

var sequelize = new Sequelize(config.persistence.database, config.persistence.username, config.persistence.password, persistenceOptions);

//convenience method to start a transaction only if none is already started
sequelize.requireTransaction = function(query){
    return Sequelize.cls.get('transaction') ? query(Sequelize.cls.get('transaction')) : this.transaction(query);
};

//default Model.count is not working with SSACL (see https://github.com/pumpupapp/ssacl/issues/4)
Sequelize.Model.prototype.count = function(options){
    return this.findAll(
            _.merge(
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

Sequelize.Model.prototype.findAndCountAll = function(options){
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

var db = {};

//load all models in the folder
fs
    .readdirSync(__dirname)
    .filter(function (file) {
        return fs.statSync(path.join(__dirname, file)).isFile() && file !== "index.js";
    })
    .forEach(function (file) {
        var model = sequelize.import(path.join(__dirname, file));
        db[model.name] = model;
    });

//add custom data attrribute
_.values(db)
    .filter(function(m){
        return m.isCustomizable();
    })
    .forEach(function(m){
        m.rawAttributes.customData = {
            type: Sequelize.STRING(10485760),
            get: function(){
                return {href: this.href+'/customData'};
            },
            set: function(val){
                this.setDataValue('customData', JSON.stringify( _.assign(JSON.parse(this.getDataValue('customData') || "{}"), _.omit(val, 'href', 'createdAt', 'modifiedAt'))));
            },
            defaultValue: '{}'
        };
        m.refreshAttributes ();
        m.Instance.prototype.getCustomData = function(){
            return _.assign(
                JSON.parse(this.getDataValue('customData')),
                {
                    href: this.href+'/customData',
                    createdAt: this.createdAt,
                    modifiedAt: this.modifiedAt
                }
            );
        };
        m.Instance.prototype.deleteCustomDataField = function(fieldName){
            this.setDataValue(
                'customData',
                JSON.stringify(_.omit(JSON.parse(this.getDataValue('customData')), fieldName)));
        };
    });
// set up the associations between models
_(sequelize.models)
        .values()
        .filter(function(m){return m.associate;})
        .sortBy(function(m){return m.associatePriority;})
        .forEach(function(m){m.associate(sequelize.models);});

//post-association hooks
_(sequelize.models)
        .values()
        .filter(function(m){return m.afterAssociate;})
        .forEach(function(m){m.afterAssociate(sequelize.models);});

db.migrate = function(){
    return new Umzug({
        storage: 'sequelize',
        storageOptions: {
            sequelize: sequelize,
            modelName: 'completedMigrations'
        },
        migrations:{
            params: [ sequelize.getQueryInterface(), Sequelize, db ],
            pattern: /\.js$/
        }
    })
    .up();
};

db.useSsacl = function(ssacl, cls){
    _.forIn(sequelize.models, function(value){
        if(value.getAclAttribute){
            var aclAttribute = value.getAclAttribute();
            ssacl(
                    value,
                    {
                        cls: cls,
                        //paranoia: false,
                        read: {attribute: aclAttribute},
                        write: {attribute: aclAttribute}
                    }
                    
            );
        }
    });
};

function resolveHref(href){
    //unqualify href
    var split = _.compact(hrefHelper.unqualifyHref(href).split('/'));
    if(split.length === 2){
        var model = _.find(_.values(sequelize.models), function(m){return m.options.name.plural === split[0];});
        if(model){
            return model.build({id:split[1]});
        }
    }
}
db.resolveHref = resolveHref;

db.sequelize = sequelize;
module.exports = db;