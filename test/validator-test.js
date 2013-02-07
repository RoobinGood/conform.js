var assert = require('assert'),
    vows = require('vows'),
    revalidator = require('../lib/revalidator');

function clone(object) {
  return Object.keys(object).reduce(function (obj, k) {
    obj[k] = object[k];
    return obj;
  }, {});
};


function assertInvalid(res) {
  assert.isObject(res);
  assert.strictEqual(res.valid, false);
}

function assertValid(res) {
  assert.isObject(res);
  assert.strictEqual(res.valid, true);
}

function assertHasError(attr, field) {
  return function (res) {
    assert.notEqual(res.errors.length, 0);
    assert.ok(res.errors.some(function (e) {
      return e.attribute === attr && (field ? e.property === field : true);
    }));
  };
}

function assertHasErrorMsg(attr, msg) {
  return function (res) {
    assert.notEqual(res.errors.length, 0);
    assert.ok(res.errors.some(function (e) {
      return e.attribute === attr && e.message === msg;
    }));
  };
}

function assertValidates(passingValue, failingValue, attributes) {
  var schema = {
    name: 'Resource',
    properties: { field: {} }
  };

  var failing;

  if (!attributes) {
    attributes = failingValue;
    failing = false;
  } else {
    failing = true;
  }

  var attr = Object.keys(attributes)[0];
  revalidator.mixin(schema.properties.field, attributes);

  var result = {
    "when the object conforms": {
      topic: function () {
        return revalidator.validate({ field: passingValue }, schema);
      },
      "return an object with `valid` set to true": assertValid
    }
  };

  if (failing) {
    result["when the object does not conform"] ={
      topic: function () {
        return revalidator.validate({ field: failingValue }, schema);
      },
      "return an object with `valid` set to false": assertInvalid,
      "and an error concerning the attribute":      assertHasError(Object.keys(attributes)[0], 'field')
    };
  };

  return result;
}

vows.describe('revalidator', {
  "Validating": {
    "with <type>:'string'":       assertValidates ('hello',   42,        { type: "string" }),
    "with <type>:'number'":       assertValidates (42,       'hello',    { type: "number" }),
    "with <type>:'integer'":      assertValidates (42,        42.5,      { type: "integer" }),
    "with <type>:'array'":        assertValidates ([4, 2],   'hi',       { type: "array" }),
    "with <type>:'object'":       assertValidates ({},        [],        { type: "object" }),
    "with <type>:'boolean'":      assertValidates (false,     42,        { type: "boolean" }),
    "with <types>:bool,num":      assertValidates (false,     'hello',   { type: ["boolean", "number"] }),
    "with <types>:bool,num":      assertValidates (544,       null,      { type: ["boolean", "number"] }),
    "with <type>:'null'":         assertValidates (null,      false,     { type: "null" }),
    "with <type>:'any'":          assertValidates (9,                    { type: "any" }),
    "with <pattern>":             assertValidates ("kaboom", "42",       { pattern: /^[a-z]+$/ }),
    "with <maxLength>":           assertValidates ("boom",   "kaboom",   { maxLength: 4 }),
    "with <minLength>":           assertValidates ("kaboom", "boom",     { minLength: 6 }),
    "with <minimum>":             assertValidates ( 512,      43,        { minimum:   473 }),
    "with <maximum>":             assertValidates ( 512,      1949,      { maximum:   678 }),
    "with <divisibleBy>":         assertValidates ( 10,       9,         { divisibleBy: 5 }),
    "with <divisibleBy> decimal": assertValidates ( 0.2,      0.009,     { divisibleBy: 0.01 }),
    "with <enum>":                assertValidates ("orange",  "cigar",   { enum: ["orange", "apple", "pear"] }),
    "with <format>:'url'":        assertValidates ('http://test.com/', 'hello', { format: 'url' }),
    "with <dependencies>": {
      topic: {
        properties: {
          town:    { dependencies: "country" },
          country: { }
        }
      },
      "when the object conforms": {
        topic: function (schema) {
          return revalidator.validate({ town: "luna", country: "moon" }, schema);
        },
        "return an object with `valid` set to true": assertValid
      },
      "when the object does not conform": {
        topic: function (schema) {
          return revalidator.validate({ town: "luna" }, schema);
        },
        "return an object with `valid` set to false": assertInvalid,
        "and an error concerning the attribute":      assertHasError('dependencies')
      }
    },
    "with <dependencies> as array": {
      topic: {
        properties: {
          town:    { dependencies: ["country", "planet"] },
          country: { },
          planet: { }
        }
      },
      "when the object conforms": {
        topic: function (schema) {
          return revalidator.validate({ town: "luna", country: "moon", planet: "mars" }, schema);
        },
        "return an object with `valid` set to true": assertValid
      },
      "when the object does not conform": {
        topic: function (schema) {
          return revalidator.validate({ town: "luna", planet: "mars" }, schema);
        },
        "return an object with `valid` set to false": assertInvalid,
        "and an error concerning the attribute":      assertHasError('dependencies')
      }
    },
    "with <dependencies> as schema": {
      topic: {
        properties: {
          town:    {
            type: 'string',
            dependencies: {
              properties: { x: { type: "number" } }
            }
          },
          country: { }
        }
      },
      "when the object conforms": {
        topic: function (schema) {
          return revalidator.validate({ town: "luna", x: 1 }, schema);
        },
        "return an object with `valid` set to true": assertValid,
      },
      "when the object does not conform": {
        topic: function (schema) {
          return revalidator.validate({ town: "luna", x: 'no' }, schema);
        },
        "return an object with `valid` set to false": assertInvalid
      }
    },
    "with <type>:'integer' and": {
      "<minimum> constraints":      assertValidates ( 512,      43,        { minimum:   473, type: 'integer' }),
      "<maximum> constraints":      assertValidates ( 512,      1949,      { maximum:   678, type: 'integer' }),
      "<divisibleBy> constraints":  assertValidates ( 10,       9,         { divisibleBy: 5, type: 'integer' })
    },
    "with <additionalProperties>:false": {
      topic: {
        properties: {
          town: { type: 'string' }
        },
        additionalProperties: false
      },
      "when the object conforms": {
        topic: function (schema) {
          return revalidator.validate({ town: "luna" }, schema);
        },
        "return an object with `valid` set to true": assertValid
      },
      "when the object does not conform": {
        topic: function (schema) {
          return revalidator.validate({ town: "luna", area: 'park' }, schema);
        },
        "return an object with `valid` set to false": assertInvalid
      }
    },
    "with option <additionalProperties>:false": {
      topic: {
        properties: {
          town: { type: 'string' }
        }
      },
      "when the object conforms": {
        topic: function (schema) {
          return revalidator.validate({ town: "luna" }, schema, {additionalProperties: false});
        },
        "return an object with `valid` set to true": assertValid
      },
      "when the object does not conform": {
        topic: function (schema) {
          return revalidator.validate({ town: "luna", area: 'park' }, schema, {additionalProperties: false});
        },
        "return an object with `valid` set to false": assertInvalid
      },
      "but overridden to true at schema": {
        topic: {
          properties: {
            town: { type: 'string' }
          },
          additionalProperties: true
        },
        "when the object does not conform": {
          topic: function (schema) {
            return revalidator.validate({ town: "luna", area: 'park' }, schema, {additionalProperties: false});
          },
          "return an object with `valid` set to true": assertValid
        }
      }
    }
  }
}).addBatch({
  "A schema": {
    topic: {
      name: 'Article',
      properties: {
        title: {
          type: 'string',
          maxLength: 140,
          conditions: {
            optional: function () {
              return !this.published;
            }
          }
        },
        date: { type: 'string', format: 'date', messages: { format: "must be a valid %{expected} and nothing else" } },
        body: { type: 'string' },
        tags: {
          type: 'array',
          uniqueItems: true,
          minItems: 2,
          items: {
            type: 'string',
            pattern: /[a-z ]+/
          }
        },
        tuple: {
          type: 'array',
          minItems: 2,
          maxItems: 2,
          items: {
            type: ['string', 'number']
          }
        },
        author:    { type: 'string', pattern: /^[\w ]+$/i, required: true, messages: { required: "is essential for survival" } },
        published: { type: 'boolean', 'default': false },
        category:  { type: 'string' },
        palindrome: {type: 'string', conform: function(val) {
          return val == val.split("").reverse().join(""); }
        }
      },
      patternProperties: {
        '^_': {
          type: 'boolean', default: false
        }
      }
    },
    "and an object": {
      topic: {
        title:    'Gimme some Gurus',
        date:     '2012-02-04',
        body:     "And I will pwn your codex.",
        tags:     ['energy drinks', 'code'],
        tuple:    ['string0', 103],
        author:   'cloudhead',
        published: true,
        category: 'misc',
        palindrome: 'dennis sinned',
        _flag: true
      },
      "can be validated with `revalidator.validate`": {
        "and if it conforms": {
          topic: function (object, schema) {
            return revalidator.validate(object, schema);
          },
          "return an object with the `valid` property set to true": assertValid,
          "return an object with the `errors` property as an empty array": function (res) {
            assert.isArray(res.errors);
            assert.isEmpty(res.errors);
          }
        },
        "and if it has a missing required property": {
          topic: function (object, schema) {
            object = clone(object);
            delete object.author;
            return revalidator.validate(object, schema);
          },
          "return an object with `valid` set to false":       assertInvalid,
          "and an error concerning the 'required' attribute": assertHasError('required'),
          "and the error message defined":                    assertHasErrorMsg('required', "is essential for survival")
        },
        "and if it has a missing non-required property": {
          topic: function (object, schema) {
            object = clone(object);
            delete object.category;
            return revalidator.validate(object, schema);
          },
          "return an object with `valid` set to false":       assertValid
        },
        "and if it has a incorrect pattern property": {
          topic: function (object, schema) {
            object = clone(object);
            object._additionalFlag = 'text';
            return revalidator.validate(object, schema);
          },
          "return an object with `valid` set to false":       assertInvalid
        },
        "and if it has a incorrect unique array property": {
          topic: function (object, schema) {
            object = clone(object);
            object.tags = ['a', 'a'];
            return revalidator.validate(object, schema);
          },
          "return an object with `valid` set to false":       assertInvalid
        },
        "and if it has a incorrect array property (wrong values)": {
          topic: function (object, schema) {
            object = clone(object);
            object.tags = ['a', '____'];
            return revalidator.validate(object, schema);
          },
          "return an object with `valid` set to false":       assertInvalid
        },
        "and if it has a incorrect array property (< minItems)": {
          topic: function (object, schema) {
            object = clone(object);
            object.tags = ['x'];
            return revalidator.validate(object, schema);
          },
          "return an object with `valid` set to false":       assertInvalid
        },
        "and if it has a incorrect format (date)": {
          topic: function (object, schema) {
            object = clone(object);
            object.date = 'bad date';
            return revalidator.validate(object, schema);
          },
          "return an object with `valid` set to false":       assertInvalid,
          "and the error message defined":                    assertHasErrorMsg('format', "must be a valid date and nothing else")
        },
        "and if it is not a palindrome (conform function)": {
          topic: function (object, schema) {
            object = clone(object);
            object.palindrome = 'bad palindrome';
            return revalidator.validate(object, schema);
          },
          "return an object with `valid` set to false":       assertInvalid
        },
        "and if it didn't validate a pattern": {
          topic: function (object, schema) {
            object = clone(object);
            object.author = 'email@address.com';
            return revalidator.validate(object, schema);
          },
          "return an object with `valid` set to false":      assertInvalid,
          "and an error concerning the 'pattern' attribute": assertHasError('pattern')
        },
      }
    },
    "with <cast> option": {
      topic: {
        properties: {
          answer: { type: "integer" },
          is_ready: { type: "boolean" }
        }
      },
      "and <integer> property": {
        "is castable string": {
          topic: function (schema) {
            return revalidator.validate({ answer: "42" }, schema, { cast: true });
          },
          "return an object with `valid` set to true": assertValid
        },
        "is uncastable string": {
          topic: function (schema) {
            return revalidator.validate({ answer: "forty2" }, schema, { cast: true });
          },
          "return an object with `valid` set to false": assertInvalid
        }
      },
      "and option <castSource>:true": {
        topic: function () {
          var schema = {
            properties: {
              answer: { type: "integer" },
              answer2: { type: "number" },
              is_ready1: { type: "boolean" },
              is_ready2: { type: "boolean" },
              is_ready3: { type: "boolean" },
              is_ready4: { type: "boolean" },
              is_ready5: { type: "boolean" },
              is_ready6: { type: "boolean" },
            }
          };
          var source = {
            answer: "42",
            answer2: "42.2",
            is_ready1: "true",
            is_ready2: "1",
            is_ready3: 1,
            is_ready4: "false",
            is_ready5: "0",
            is_ready6: 0
          };
          var options = { cast: true, castSource: true };
          return {
            res: revalidator.validate(source, schema, options),
            source: source
          };
        },
        "return an object with `valid` set to true": function(topic) {
          return assertValid(topic.res);
        },
        "and modified source object": {
          "with integer": function(topic) {
            return assert.strictEqual(topic.source.answer, 42);
          },
          "with float": function(topic) {
            return assert.strictEqual(topic.source.answer2, 42.2);
          },
          "with boolean true from string 'true'": function(topic) {
            return assert.strictEqual(topic.source.is_ready1, true);
          },
          "with boolean true from string '1'": function(topic) {
            return assert.strictEqual(topic.source.is_ready2, true);
          },
          "with boolean true from number 1": function(topic) {
            return assert.strictEqual(topic.source.is_ready3, true);
          },
          "with boolean false from string 'false'": function(topic) {
            return assert.strictEqual(topic.source.is_ready4, false);
          },
          "with boolean false from string '0'": function(topic) {
            return assert.strictEqual(topic.source.is_ready5, false);
          },
          "with boolean false from number 0": function(topic) {
            return assert.strictEqual(topic.source.is_ready6, false);
          },
        }
      },
      "and <boolean> property": {
        "is castable 'true/false' string": {
          topic: function (schema) {
            return revalidator.validate({ is_ready: "true" }, schema, { cast: true });
          },
          "return an object with `valid` set to true": assertValid
        },
        "is castable '1/0' string": {
          topic: function (schema) {
            return revalidator.validate({ is_ready: "1" }, schema, { cast: true });
          },
          "return an object with `valid` set to true": assertValid
        },
        "is castable `1/0` integer": {
          topic: function (schema) {
            return revalidator.validate({ is_ready: 1 }, schema, { cast: true });
          },
          "return an object with `valid` set to true": assertValid
        },
        "is uncastable string": {
          topic: function (schema) {
            return revalidator.validate({ is_ready: "not yet" }, schema, { cast: true });
          },
          "return an object with `valid` set to false": assertInvalid
        },
        "is uncastable number": {
          topic: function (schema) {
            return revalidator.validate({ is_ready: 42 }, schema, { cast: true });
          },
          "return an object with `valid` set to false": assertInvalid
        }
      }
    },
    "with <applyDefaultValue> option": {
      topic: {
        properties: {
          town: {
            type: "string"
          },
          country: {
            type: "object",
            properties: {
              id: { type: "integer" },
              name: { type: "string" }
            },
            "default": {
              id: 1,
              name: "New Zealand"
            }
          },
          planet: {
            "type": "string",
            "default": "Earth"
          }
        }
      },
      "enabled": {
        "and acting": {
          topic: function (schema) {
            var source = { town: "Auckland" };
            return {
              res: revalidator.validate(source, schema, {applyDefaultValue: true}),
              source: source
            }
          },
          "return an object with `valid` set to true": function(topic) {
            return assertValid(topic.res);
          },
          "and source object with default country and planet": function(topic) {
            assert.strictEqual(topic.source.town, "Auckland");
            assert.deepEqual(topic.source.country, {
              id: 1, name: "New Zealand"
            });
            assert.strictEqual(topic.source.planet, "Earth");
          }
        },
        "but not acting (since values in source object is set)": {
          topic: function (schema) {
            var source = {
              town: "New York",
              country: {
                id: 2,
                name: "USA"
              },
              planet: "Mars"
            };
            return {
              res: revalidator.validate(source, schema, {applyDefaultValue: true}),
              source: source
            }
          },
          "return an object with `valid` set to true": function(topic) {
            return assertValid(topic.res);
          },
          "and not modified source object": function(topic) {
            assert.strictEqual(topic.source.town, "New York");
            assert.deepEqual(topic.source.country, {id: 2, name: "USA"});
            assert.strictEqual(topic.source.planet, "Mars");
          }
        }
      },
      "not enabled": {
          topic: function (schema) {
            var source = { town: "Auckland" };
            return { res: revalidator.validate(source, schema), source: source }
          },
          "return an object with `valid` set to true": function(topic) {
            return assertValid(topic.res);
          },
          "and source object with undefined country and planet": function(topic) {
            assert.strictEqual(topic.source.town, "Auckland");
            assert.strictEqual(topic.source.country, undefined);
            assert.strictEqual(topic.source.planet, undefined);
          }
      }
    }
  }
}).export(module);
