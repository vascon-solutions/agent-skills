const assert = require('assert');
const test = require('node:test');

const meta = require('./metadata.js');

test('replacePublishedSection creates fresh metadata when none exists', () => {
  const result = meta.replacePublishedSection(null, 'demo', ['- entry']);
  assert.match(result, /^# demo Metadata\n\n## Published\n\n- entry/m);
});

test('replacePublishedSection replaces only the Published section', () => {
  const existing = '# Title\n\nIntro\n\n## Published\n\nold\n\n## Notes\n\nkeep\n';
  const replaced = meta.replacePublishedSection(existing, 'demo', ['- new']);
  assert.equal(replaced, '# Title\n\nIntro\n\n## Published\n\n- new\n\n## Notes\n\nkeep\n');
});

test('redactPublishedSection redacts presigned and gist URLs only inside Published', () => {
  const m = [
    '# Meta',
    '',
    'outside https://example.com/keep',
    '',
    '## Published',
    '- `markdown/doc.md` — https://bucket.s3.amazonaws.com/x?token=secret',
    '- `markdown/doc.md` — https://gist.github.com/u/id',
    '',
    '## Notes',
    'https://example.com/still-keep',
  ].join('\n');
  const redacted = meta.redactPublishedSection(m);
  assert.match(redacted, /<presigned URL — see local metadata>/);
  assert.match(redacted, /<gist URL — see local metadata>/);
  assert.match(redacted, /outside https:\/\/example.com\/keep/);
  assert.match(redacted, /https:\/\/example.com\/still-keep/);
});

test('findExistingGist returns id and url when present', () => {
  const m = '## Published\n\n- `markdown/doc.md` — https://gist.github.com/user/abc123\n';
  const hit = meta.findExistingGist(m, 'markdown/doc.md');
  assert.deepEqual(hit, { url: 'https://gist.github.com/user/abc123', id: 'abc123' });
});

test('findExistingGist returns null when missing or metadata empty', () => {
  assert.equal(meta.findExistingGist(null, 'markdown/doc.md'), null);
  assert.equal(meta.findExistingGist('## Published\n\nnone\n', 'markdown/doc.md'), null);
});
