var assert = require("assert");
var scopeHelper = require('../../src/apps/helpers/scopeHelper');

describe('scopeHelper', function(){
   describe('scopeToPaths', function(){
       it('should correctly converts bearer scopes into API endpoint paths', function(){
           var scope = {
               applications: {
                    $id: [
                        'read',
                        'write',
                        {'loginAttempt': 'create'},
                        {'account': 'delete'}
                    ]
                }
            };
            
            var paths = scopeHelper.scopeToPaths(scope);
            assert.deepStrictEqual(
                paths,
                {
                    '/applications/$id': ['get', 'post'],
                    '/applications/$id/loginAttempt': ['post'],
                    '/applications/$id/account': ['delete']
                }
            );
       });
   }) ;
});