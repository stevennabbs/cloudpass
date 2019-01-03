"use strict";

var _ = require('lodash');
var baseController = require('../helpers/baseController');
var controllerHelper = require('../helpers/controllerHelper');
var models = require('../../models');
var ApiError = require('../../ApiError');

let controller = baseController(models.factor);

controller.getChallenge = function(req, res){
    return controllerHelper.queryAndExpand(
            () => models.factor.findByPk(req.swagger.params.id.value)
                    .tap(ApiError.assertFound)
                    .then(factor => {
                        let code = _.get(req.swagger.params, 'attributes.value.code');
                        if(code){
                            if(factor.verify(code)){
                                //the factor is now verified
                                return factor.update({verificationStatus: 'VERIFIED'})
                                        .call('getChallenge', 'SUCCESS');
                            } else {
                                return factor.getChallenge('FAILED');
                            }
                        }
                        else {
                            return factor.getChallenge('CREATED');
                        }
                    }),
            req,
            res
    );
};

module.exports = controller;