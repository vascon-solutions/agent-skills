const assert = require('assert');
const test = require('node:test');

const s3 = require('./s3.js');

test('s3 driver requires bucket and region env', () => {
  assert.deepEqual(s3.requiredEnv(), ['ARTIFACTS_S3_BUCKET', 'ARTIFACTS_S3_REGION']);
});

test('s3 driver rejects bare image share keyword', () => {
  assert.throws(() => s3.validateFlags({ shares: ['images'] }), /explicit image filename/);
});

test('s3 driver exposes helpers used by top-level tests', () => {
  assert.ok(typeof s3.helpers.buildGistCreateArgs === 'function');
  assert.ok(typeof s3.helpers.resolveShareTarget === 'function');
  assert.ok(typeof s3.helpers.parseTtl === 'function');
});

test('s3 driver formatReport produces a single text block from publish result', () => {
  const lines = s3.formatReport({ text: 'hello\n' });
  assert.deepEqual(lines, ['hello']);
});
