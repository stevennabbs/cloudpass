"use strict";

var _ = require('lodash');
var controllerHelper = require('./controllerHelper');
var ApiError = require('../../ApiError');
var models = require('../../models');

module.exports = function (model, transactionalMethods) {
    return {
        create: function(req, res){
            var foreignKeys = {};
            foreignKeys[model.getAclAttribute()] = req.user.tenantId;
            return controllerHelper.createAndExpand(model, foreignKeys, req, res, _.includes(transactionalMethods, 'create'));
        },
        //get a resource by id (e.g. /directories/f6f7ee4a-0861-4873-a8d8-fc58245f93bb)
        get: function (req, res) {
            return model
                .findById(req.swagger.params.id.value)
                .tap(_.partial(ApiError.assert, _, ApiError.NOT_FOUND))
                .then(_.partial(controllerHelper.expand, _, req))
                .then(res.json.bind(res))
                .catch(req.next);
        },
        //get a collection associated to a resource (e.g. /directories/f6f7ee4a-0861-4873-a8d8-fc58245f93bb/accounts)
        getCollection: function(req, res){
            controllerHelper.getCollection(model, req.swagger.params.collection.value, req, res);
        },
        //get custom data associated to a resource
        getCustomData: function(req, res){
            return model
                .findById(req.swagger.params.id.value)
                .then(function(resource){
                    ApiError.assert(resource, ApiError.NOT_FOUND);
                    res.json(resource.getCustomData());
                })
                .catch(req.next);
        },
        update: function(req, res){
            return controllerHelper.execute(
                function(){
                   return model
                    .findById(req.swagger.params.id.value)
                    .then(function(resource){
                        ApiError.assert(resource, ApiError.NOT_FOUND);
                        return resource.update(req.swagger.params.newAttributes.value, {fields:  model.getSettableAttributes()});
                    }); 
                },
                _.includes(transactionalMethods, 'update')
            )
            .then(_.partial(controllerHelper.expand, _, req))
            .then(res.json.bind(res))
            .catch(req.next);
        },
        updateCustomData: function(req, res){
            return model
                .findById(req.swagger.params.id.value)
                .then(function(resource){
                    ApiError.assert(resource, ApiError.NOT_FOUND);
                    resource.set('customData', req.swagger.params.newCustomData.value);
                    return resource.save();
                })
                .then(function(updatedResource){
                    res.json(updatedResource.getCustomData());
                })
                .catch(req.next);
        },
        //delete a resource:
        delete: function(req, res){
            return controllerHelper.execute(
               function(){
                   return model.destroy({where:{id: req.swagger.params.id.value}, limit: 1, individualHooks: true});
               },
               _.includes(transactionalMethods, 'delete')
            )
            .then(function(rowNb){
                ApiError.assert(rowNb, ApiError.NOT_FOUND);
                res.status(204).json();
            }).catch(req.next);
        },
        deleteCustomData: function(req, res){
            return model
                .update({customData: {}}, {where: {id: req.swagger.params.id.value}})
                .spread(function(rowNb){
                    ApiError.assert(rowNb, ApiError.NOT_FOUND);
                    res.status(204).json();
                }).catch(req.next);
        },
        deleteCustomDataField: function(req, res){
            return model
                .findById(req.swagger.params.id.value)
                .then(function(resource){
                    ApiError.assert(resource, ApiError.NOT_FOUND);
                    resource.deleteCustomDataField(req.swagger.params.fieldName.value);
                    return resource.save();
                }).then(function(updatedResource){
                    if(updatedResource instanceof models.sequelize.ValidationError){
                        throw updatedResource;
                    } else {
                        res.status(204).json();
                    }
                }).catch(req.next);
        }
    };
};