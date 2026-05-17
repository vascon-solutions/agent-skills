const assert = require('assert');
const test = require('node:test');

const { rewriteImagePaths } = require('./markdown-rewrite.js');

test('rewriteImagePaths leaves absolute URLs untouched', () => {
  const body = '![alt](https://example.com/x.png)\n';
  const { content, warnings } = rewriteImagePaths(body, { relativeMap: {}, sourceRelative: 'markdown/doc.md' });
  assert.equal(content, body);
  assert.deepEqual(warnings, []);
});

test('rewriteImagePaths rewrites a relative path when an upload mapping is provided', () => {
  const body = '![alt](../images/pic.png)\n';
  const { content, warnings } = rewriteImagePaths(body, {
    relativeMap: { 'images/pic.png': 'https://signed.example/images/pic.png?sig=1' },
    sourceRelative: 'markdown/doc.md',
  });
  assert.match(content, /https:\/\/signed\.example\/images\/pic\.png\?sig=1/);
  assert.deepEqual(warnings, []);
});

test('rewriteImagePaths warns when a relative path has no mapping', () => {
  const body = '![alt](../images/missing.png)\n';
  const { content, warnings } = rewriteImagePaths(body, { relativeMap: {}, sourceRelative: 'markdown/doc.md' });
  assert.equal(content, body);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /images\/missing\.png/);
});

test('rewriteImagePaths handles HTML img tags', () => {
  const body = '<img src="../images/pic.png" alt="x">\n';
  const { content } = rewriteImagePaths(body, {
    relativeMap: { 'images/pic.png': 'https://signed.example/images/pic.png' },
    sourceRelative: 'markdown/doc.md',
  });
  assert.match(content, /https:\/\/signed\.example\/images\/pic\.png/);
});
