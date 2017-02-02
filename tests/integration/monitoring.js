const assert = require('assert');
const request = require('supertest-as-promised');
const monitoringApp = require('../../src/apps/monitoring');

describe('monitoring', function () {
    it('health check', function () {
        request(monitoringApp).get('')
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
});
