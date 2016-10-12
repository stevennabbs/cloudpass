var assert = require("assert");
var getMandrillFields = require('rewire')('../../src/sendEmail').__get__('getMandrillFields');

describe('sendEmail', function(){
    it('getMandrillFields', function(){
        var templateName = 'template-name';
        assert.deepStrictEqual(
            getMandrillFields(
                templateName,
                {
                        a:1,
                        b:{
                            c: true,
                            d: {
                                e: 'f'
                            }
                        }
                    }
            ),
            {
                subject: null,
                text: null,
                html: null,
                from: null,
                mandrillOptions: {
                    template_name: templateName,
                    template_content: [],
                    message:{
                        global_merge_vars: [
                            {
                                name: 'a',
                                content: 1
                            },
                            {
                                name: 'b',
                                content: {
                                    c: true,
                                    d: {
                                        e: 'f'
                                    }
                                }
                            }
                        ]
                    }
                }
            }
        );
    });
});