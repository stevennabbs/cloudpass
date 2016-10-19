var assert = require("assert");
var models = require('../../src/models');
var hrefHelper = require('../../src/models/helpers/hrefHelper');

describe('models', function(){
   it('resolveHref', function(){
       var instance = models.resolveHref('http://www.example.com/v1/tenants/3e6447e7-39db-473e-a30f-d5be9f9b8140');
       assert.strictEqual(instance.Model, models.tenant);
       assert.strictEqual(instance.id, '3e6447e7-39db-473e-a30f-d5be9f9b8140');
   });
});