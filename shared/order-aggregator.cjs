'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const filename = path.join(__dirname, 'order-aggregator.js');
const sandbox = {
  module: {exports: {}}, exports: {},
  Intl, Date, Math, Number, String, Boolean, Object, Array, Map, Set, RegExp,
  Error, TypeError, RangeError, console
};
sandbox.globalThis = sandbox;
vm.runInNewContext(fs.readFileSync(filename, 'utf8'), sandbox, {filename});
module.exports = sandbox.module.exports;
