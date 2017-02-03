const assert = require('assert');
const request = require('supertest');
const monitoringApp = require('../../src/apps/monitoring');

describe('monitoring', function () {
    it('health check', function () {
        request(monitoringApp).get('/health')
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
        request(monitoringApp).get('/version')
            .expect(200)
            .then(res => {
               assert.strictEqual(res.body, require('../../package.json').version);
            });
    });
});
