var assert = require("assert");
var init = require('./init');
var moment = require('moment');
var crypto = require('crypto');
var url = require('url');
var http = require('http');
var BluebirdPromise = require('sequelize').Promise;
var request = require('supertest');

describe('SAuthc1', function(){
    var application;
     before(function(){
        return init.getRequest('tenants/'+init.apiKey.tenantId+'/applications')
            .query({ name: 'Cloudpass', limit: 1})
            .expect(200)
            .then(function(res){
                application = res.body.items[0];
            });
     });

     it('GET', function(){
         return sendAauthc1Request('/v1/tenants/'+init.apiKey.tenantId, null, 'GET')
              .then(function(res){
                    assert.strictEqual(res.status, 200);
                    assert(res.body.href);
              });
     });

     it('GET with query', function(){
         return sendAauthc1Request('/v1/tenants/'+init.apiKey.tenantId, "expand=applications", 'GET')
              .then(function(res){
                    assert.strictEqual(res.status, 200);
                    assert(res.body.href);
                    assert(res.body.applications.items);
              });
     });

     it('POST', function(){
         return sendAauthc1Request('/v1/tenants/'+init.apiKey.tenantId, null, 'POST', {customData: {}})
              .then(function(res){
                    assert.strictEqual(res.status, 200);
              });
     });

     it('Invalid digest', function(){
         return request(init.servers.main).get('/v1/tenants/'+init.apiKey.tenantId)
                    .set('authorization', 'SAuthc1 sauthc1Id=201c2ec2-6d42-47b1-ba85-3b5ca3700b38/20160223/2639dabba1390038/sauthc1_request, sauthc1SignedHeaders=content-type;host;x-stormpath-date, sauthc1Signature=51d68f16f209d1ac4ba3cfcdcb476d36cfa1eeecae976e749c889af0738dbe41')
                    .expect(401);
     });
});

//strongly inspired from https://github.com/stormpath/stormpath-sdk-node/blob/master/lib/authc/Sauthc1RequestAuthenticator.js
function sendAauthc1Request(path, query, method, body) {
    var AUTHORIZATION_HEADER = 'Authorization',
            ID_TERMINATOR = 'sauthc1_request',
            ALGORITHM = 'HMAC-SHA-256',
            AUTHENTICATION_SCHEME = 'SAuthc1',
            SAUTHC1_ID = 'sauthc1Id',
            SAUTHC1_SIGNED_HEADERS = 'sauthc1SignedHeaders',
            SAUTHC1_SIGNATURE = 'sauthc1Signature',
            NL = '\n';
    var host = 'localhost', port = 20020;
    var apiKey = init.apiKey;

    function encodeUrl(path) {
        return path
                .replace('+', '%20')
                .replace('*', '%2A')
                .replace('%7E', '~')
                .replace('%2F', '/');
    }

    function sha256(string) {
        return crypto.createHash('sha256').update(Buffer.from(string, 'utf8')).digest();
    }

    function sign(data, key) {
        if (typeof data === 'string') {
            data = Buffer.from(data, 'utf8');
        }
        return crypto.createHmac('sha256', key).update(data).digest();
    }


    var timeStamp = moment.utc().format('YYYYMMDDTHHmmss[Z]');
    var dateStamp = moment.utc().format('YYYYMMDD');
    var nonce = crypto.randomBytes(8).toString('hex');

    var headers = {
        'Host': host + ':' + port,
        'X-Stormpath-Date': timeStamp
    };
    var bodyString = '';
    if(body){
        bodyString = JSON.stringify(body);
        headers['Content-Type'] = 'application/json';
    }
    var sortedHeaderKeys = Object.keys(headers).sort();
    var canonicalHeadersString = '';
    sortedHeaderKeys.forEach(function (val) {
        canonicalHeadersString += val.toLowerCase() + ':' + headers[val] + NL;
    });

    var canonicalResourcePath = encodeUrl(path);
    var canonicalQueryString = query ? encodeUrl(query): '';
    var signedHeadersString = sortedHeaderKeys.join(';').toLowerCase();
    var requestPayloadHashHex = sha256(bodyString).toString('hex');
    var canonicalRequest = [method, canonicalResourcePath, canonicalQueryString,
        canonicalHeadersString, signedHeadersString, requestPayloadHashHex]
            .join(NL);

    var id = [apiKey.id, dateStamp, nonce, ID_TERMINATOR].join('/');

    var canonicalRequestHashHex = sha256(canonicalRequest).toString('hex');

    var stringToSign = [ALGORITHM, timeStamp, id, canonicalRequestHashHex].join(NL);

    // SAuthc1 uses a series of derived keys, formed by hashing different
    // pieces of data

    var kSecret = AUTHENTICATION_SCHEME + apiKey.secret;
    var kDate = sign(dateStamp, kSecret);
    var kNonce = sign(nonce, kDate);
    var kSigning = sign(ID_TERMINATOR, kNonce);

    var signature = sign(stringToSign, kSigning);
    var signatureHex = signature.toString('hex');

    var authorizationHeader = [
        AUTHENTICATION_SCHEME + ' ' + SAUTHC1_ID + '=' + id,
        SAUTHC1_SIGNED_HEADERS + '=' + signedHeadersString,
        SAUTHC1_SIGNATURE + '=' + signatureHex
    ].join(', ');

    headers[AUTHORIZATION_HEADER] = authorizationHeader;

    return BluebirdPromise.fromCallback(function(callback){
        var req = http.request(
                {
                    host: host,
                    path: query?path+'?'+query:path,
                    port: port,
                    method: method,
                    headers: headers
                },
                function (response) {
                    var str = '';
                    response.on('data', function (chunk) {
                        str += chunk;
                    });

                    response.on('end', function () {
                        callback(
                            null,
                            {
                                status: response.statusCode,
                                header: response.headers,
                                body: str? JSON.parse(str): ''
                            }
                        );
                    });
                }
        );

        if(bodyString){
            req.write(Buffer.from(bodyString, 'utf8'));
        }
        req.end();
    });
};
