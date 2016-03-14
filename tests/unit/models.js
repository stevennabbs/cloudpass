var assert = require("assert");
var models = require('../../src/models');

describe('models', function(){
   it('getRootUrl', function(){
       assert.strictEqual(models.getRootUrl('http://www.example.com/v1/tenants/3e6447e7-39db-473e-a30f-d5be9f9b8140'), 'http://www.example.com');
       assert.strictEqual(models.getRootUrl('http://www.example.com/id/v1/tenants/3e6447e7-39db-473e-a30f-d5be9f9b8140'), 'http://www.example.com/id');
   });
   
   it('unqualifyHref', function(){
       assert.strictEqual(models.unqualifyHref('http://www.example.com/v1/tenants/3e6447e7-39db-473e-a30f-d5be9f9b8140'), 'tenants/3e6447e7-39db-473e-a30f-d5be9f9b8140');
       assert.strictEqual(models.unqualifyHref('http://www.example.com/id/v1/tenants/3e6447e7-39db-473e-a30f-d5be9f9b8140'), 'tenants/3e6447e7-39db-473e-a30f-d5be9f9b8140');
   });
   
   it('resolveHref', function(){
       var instance = models.resolveHref('http://www.example.com/v1/tenants/3e6447e7-39db-473e-a30f-d5be9f9b8140');
       assert.strictEqual(instance.Model, models.tenant);
       assert.strictEqual(instance.id, '3e6447e7-39db-473e-a30f-d5be9f9b8140');
   });
});