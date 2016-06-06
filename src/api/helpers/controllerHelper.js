"use strict";

var BluebirdPromise = require('sequelize').Promise;
var _ = require('lodash');
var models = require('../../models');
var ApiError = require('../../ApiError');

var defaultPagination = {offset:0, limit:25};

function createCollectionResource(href, pagination, size, items) {
    return {
        'href': href,
        'offset': pagination.offset,
        'limit': pagination.limit,
        'size': size,
        'items': items
    };
}

function caseInsensitiveLikeClause(target, columnName, matchedString){
    var sequelize = models.sequelize;
    return sequelize.where(sequelize.fn('lower', sequelize.cast(sequelize.col(target.name+'.'+columnName), 'text')), {$like : matchedString.toLowerCase()});
}

//parse an 'orderBy' query param into sequelize 'order' clause
function getOrderClause(orderParam){
    if(orderParam){
        return _.map(
              orderParam,
              function(orderStatement){
                var split = orderStatement.split(' ');
                switch(split.length){
                    case 1:
                        return split[0];
                    case 2:
                        return (split[1].toUpperCase() === 'DESC')?[split[0], 'DESC']:split[0];
                    default:
                        throw new ApiError(
                            400,
                            2104,
                            "Invalid orderBy clause '" + orderStatement + "'.  An order statement must be a queryable property optionally followed by a space character and order direction token (asc or desc).");
                    }
            }
        );
    } else {
        //if no order clause is specified, we must still order the results to ensure a consistent pagination
        //('id' is present and indexed in all tables)
        return ['id'];
    }
}

function getWhereClause(query, target){
     var searcheableAttributes = target.getSearchableAttributes();
    //search in a specific attribute
    var whereClauses =
        _(searcheableAttributes)
                .filter(function(a){return query.hasOwnProperty(a);})
                .map(function(a){
                    return caseInsensitiveLikeClause(target, a, query[a].replace(/\*/g, '%'));
                 })
                .value();

    //'q' paramter = search in all searchable attributes
    if(query.q){
        whereClauses.push({
            '$or':
            _(searcheableAttributes)
                .map(function(a){
                    return caseInsensitiveLikeClause(target, a, '%'+query.q+'%');
                })
                .value()
        });
    }
        
    switch(whereClauses.length){
        case 0:
            return undefined;
        case 1:
            return whereClauses[0];
        default:
            return {$and: whereClauses};
    }
}

function getCollectionQueryOptions(req, target){
    return _.defaults(
                _.pickBy({
                    offset: req.swagger.params.offset.value,
                    limit: req.swagger.params.limit.value,
                    order: getOrderClause(req.swagger.params.orderBy.value),
                    where: getWhereClause(req.query, target)
                }),
            defaultPagination);
}

function getExpands(expandParam){
    //get the expand parameter, e.g. 'tenant,groups(offset:0,limit:10)'
    //and split the different parts: ['tenant', 'groups(offset:0,limit:10)']
    var expands = {};
    if(expandParam){
        var expandStrings = expandParam.split(/,(?!offset|limit)/);
        for(var i in expandStrings){
            //separate the association name and the pagination parts
            var expandParts = /^([^\(]*)\(([^\)]*)\)*$/.exec(expandStrings[i]);
            var associationName = null, pagination = null;
            if(expandParts){
                //pagination (limit or offset) was specified
                associationName = expandParts[1];
                pagination = _(expandParts[2].split(','))
                   .map(function(p){return p.split(':');})
                   .fromPairs()
                   .mapValues(parseInt)
                   .defaults(defaultPagination)
                   .value();
                   ApiError.assert(_.keysIn(pagination).length === 2, ApiError, 400, 400, 'Invalid expansion pagination: %s', expandParts[2]);
            } else {
                //no option, the whole param is the association name
                associationName =  expandStrings[i];
                pagination = defaultPagination;
            }
            
            expands[associationName] = pagination;
        }
    }
    return expands;
}
exports.getExpands = getExpands;

function expandResource(expands, resource){
    var resourceJson = resource.toJSON();
    return BluebirdPromise
            .all(
                _.map(
                    expands,
                    function(v, k){
                        var association = resource.Model.associations[k]|| _.get(resource.Model, 'customAssociations.'+k);
                        var promise = null;
                        if(association){
                            if(_.includes(['BelongsTo', 'HasOne'], association.associationType)){
                                //obviously no pagination needed
                                promise = resource[association.accessors.get]();
                            } else {
                                //the expanded is a collection
                                promise = findAndCountAssociation(resource, association, v);
                            }
                        } else {
                            //the resource must be expanded via a custom getter
                            var getterName = 'get'+_.upperFirst(k);
                            ApiError.assert(resource[getterName], ApiError, 400, 400, '%s %s is not a supported expandable property.', resource.Model.name, k);
                            promise = BluebirdPromise.resolve(resource[getterName](v));
                        }
                        
                        return promise.then(function(expandedResource){
                            if(expandedResource.count !== undefined && expandedResource.rows !== undefined){
                                //it's a resource collection
                                resourceJson[k] = createCollectionResource(
                                        resource.href+ "/" + k,
                                        v,
                                        expandedResource.count,
                                        expandedResource.rows);
                            } else {
                                //it's a single resource
                                resourceJson[k] = expandedResource;
                            }
                        });
                    }
                )
         )
        .then(function(){
            return resourceJson;
        });
}
exports.expandResource = expandResource;

function execute(query, inTransaction){
    return inTransaction ?
            models.sequelize.transaction(query):
            query();
}
exports.execute = execute;

exports.createAndExpandResource = function(model, foreignKeys, req, res, inTransaction){
   var expands = getExpands(req.swagger.params.expand.value);
   var newInstance = model.fromJSON(
            _(req.swagger.params.attributes.value)
               .pick(model.getSettableAttributes())
               .defaults(foreignKeys)
               .value());
   return execute(newInstance.save.bind(newInstance), inTransaction)
            .then(function(newInstance){
                return expandResource(expands, newInstance);
            }).then(function(expanded){
                res.json(expanded);
            }).catch(req.next);
};

function findAndCountAssociation(instance, association, options){
    //do count + get in a REPETABLE_READ transaction
    return models.sequelize.transaction(function(){
                return BluebirdPromise.join(
                    instance[association.accessors.count]({where: options.where}),
                    instance[association.accessors.get](options));
    })
    .spread(function(count, rows){
        return {count: count, rows: rows};
    });
}

exports.getCollection = function(model, collection, req, res){
    var instance = model.build({id: req.swagger.params.id.value});
    var association = model.associations[collection] || _.get(model, 'customAssociations.'+collection);
    ApiError.assert(association, ApiError.NOT_FOUND);
    
    var target = association.target;
    var expands = getExpands(_.get(req.swagger.params, 'expand.value', ''));
    var options = getCollectionQueryOptions(req, target);
    
    return findAndCountAssociation(instance, association, options)
        .then(function(result){
            return BluebirdPromise
                    .all(_.map(result.rows, _.partial(expandResource, expands)))
                    .then(function(expanded){
                        res.json(
                          createCollectionResource(
                              model.getHref(req.swagger.params.id.value)+ "/" + collection,
                              options,
                              result.count,
                              expanded));
                    });
        })
        .catch(req.next);
};
