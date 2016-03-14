var assert = require("assert");
var models = require('../../src/models');
var addAccountStoreAccessors = require('rewire')('../../src/apps/sso');

describe('sso', function(){
    describe('addParamToUri', function(){
       var addParamToUri = addAccountStoreAccessors.__get__('addParamToUri');
       
       it('should add the given param to existing query string', function(){
           assert.deepStrictEqual(addParamToUri('http://a/t/h?query=string#hash', 'foo', 'bar'), 'http://a/t/h?query=string&foo=bar#hash');
       });
       
       it('should add create a query string if none exists', function(){
           assert.deepStrictEqual(addParamToUri('http://a/t/h#hash', 'foo', 'bar'), 'http://a/t/h?foo=bar#hash');
       });
       
       it('should replace the placeholder if present', function(){
           assert.deepStrictEqual(addParamToUri('http://a/t/h?query=string#hash&foo=${foo}', 'foo', 'bar'), 'http://a/t/h?query=string#hash&foo=bar');
       });
    });
});