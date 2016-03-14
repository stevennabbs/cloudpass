var controllerHelper = require('./controllerHelper');
var baseController = require('./baseController');

module.exports = function(model){
    var controller = baseController(model, ['create', 'update', 'delete']);

    controller.create = function(req, res){
        var expands = controllerHelper.getExpands(req.swagger.params.expand.value);
        var newInstance = model.fromJSON(req.swagger.params.attributes.value);
        newInstance.set('tenantId', req.user.tenantId);
        newInstance
            .save()
            .then(function(newMapping){
                return controllerHelper.expandResource(expands, newMapping);
            }).then(function(expanded){
                res.json(expanded);
            }).catch(req.next);
    };
    
    return controller;

};