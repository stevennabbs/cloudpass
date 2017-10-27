const assert = require('assert');
const request = require('supertest');
const init = require('./init');

describe('monitoring', function () {
    it('health check', function () {
        request(init.servers.monitoring).get('/health')
            .expect(200)
            .then(res => {
                assert.deepStrictEqual(
                    res.body,
                    [{
                        "name": "database",
                        "is_healthy": true
                    }]
                );
            });
    });

    it('version', function() {
        request(init.servers.monitoring).get('/version')
            .expect(200)
            .then(res => {
               assert.strictEqual(res.body, require('../../package.json').version);
            });
    });
});
