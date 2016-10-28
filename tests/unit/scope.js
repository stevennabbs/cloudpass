var assert = require("assert");
var scopeHelper = require('../../src/apps/helpers/scopeHelper');
var isRequestAllowed = require('rewire')('../../src/apps/helpers/scopeChecker').__get__('isRequestAllowed');

var scope = {
    applications: {
        $id: [
            'read',
            'write',
            {'loginAttempts': 'create'},
            {'idSiteModel': 'read'},
            {'accounts': 'delete'}
        ]
    }
};

describe('scope', function () {
    
    describe('scopeHelper.getIdSiteScope', function(){
        it('should merge correctly the scopes of the provided instances', function(){
            assert.deepStrictEqual(
                scopeHelper.getIdSiteScope(
                    {
                        id: 'application1',
                        Model: {
                            getIdSiteScope: () => 'application1-scope',
                            options: {name: {plural: 'applications'}}
                        }
                    },
                    {
                        id: 'application1',
                        Model: {
                             getIdSiteScope: () => 'application1-scope',
                            options: {name: {plural: 'applications'}}
                        }
                    },
                    {
                        id: 'application2',
                        Model: {
                             getIdSiteScope: () => 'application2-scope',
                            options: {name: {plural: 'applications'}}
                        }
                    },
                    {
                        id: 'organization1',
                        Model: {
                            getIdSiteScope: () => 'organization1-scope',
                            options: {name: {plural: 'organizations'}}
                        }
                    }
                ),
                {
                    applications: {
                        application1: 'application1-scope',
                        application2: 'application2-scope'
                    },
                    organizations: {
                        organization1: 'organization1-scope'
                    }
                }
            );
       });
    });

    describe('scopeHelper.scopeToPaths', function () {
        it('should correctly converts bearer scopes into API endpoint paths', function () {


            var paths = scopeHelper.scopeToPaths(scope);
            assert.deepStrictEqual(
                    paths,
                    {
                        '/applications/$id': ['get', 'post'],
                        '/applications/$id/loginAttempts': ['post'],
                        '/applications/$id/idSiteModel': ['get'],
                        '/applications/$id/accounts': ['delete']
                    }
            );
        });
    });

    describe('scopeChecker', function () {
        it('should allow unscoped requests', function () {
            assert(isRequestAllowed({}));
            assert(isRequestAllowed({authInfo: {}}));
        });

        it('should allow requests within their scope', function () {
            assert(isRequestAllowed(
                    {
                        authInfo: {
                            scope: scope
                        },
                        path: '/applications/$id',
                        method: 'get',
                        query: {}
                    }
            ));
        });
        
        it('should allow expanding requests within their scope', function () {
            assert(isRequestAllowed(
                    {
                        authInfo: {
                            scope: scope
                        },
                        path: '/applications/$id',
                        method: 'get',
                        query: {expand: 'idSiteModel'}
                    }
            ));
        });
        
        it('should forbid requests with a path outside of their scope', function () {
            assert(!isRequestAllowed(
                    {
                        authInfo: {
                            scope: scope
                        },
                        path: '/applications/$id/accounts',
                        method: 'get',
                        query: {}
                    }
            ));
        });
        
        it('should forbid requests with a method outside of their scope', function () {
            assert(!isRequestAllowed(
                    {
                        authInfo: {
                            scope: scope
                        },
                        path: '/applications/$id',
                        method: 'delete',
                        query: {}
                    }
            ));
        });
        
        it('should forbid expanding requests outside of their scope', function () {
            assert(!isRequestAllowed(
                    {
                        authInfo: {
                            scope: scope
                        },
                        path: '/applications/$id',
                        method: 'get',
                        query: {expand: 'idSiteModel,accounts(limit:100)'}
                    }
            ));
        });
    });
});