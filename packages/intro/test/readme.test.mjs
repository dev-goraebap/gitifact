import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
test('published READMEs follow the canonical English and Korean sources', () => {
  assert.equal(read('../../../README.md'), read('../en/intro.md'));
  assert.equal(read('../../../README.ko.md'), read('../ko/intro.md'));
  assert.equal(read('../../../apps/cli/README.md'), read('../en/getting-started.md'));
  assert.match(read('../../../README.md'), /\[한국어\].*README\.ko\.md/);
  assert.match(read('../../../apps/cli/README.md'), /\[한국어\].*ko\/getting-started\.md/);
});
test('both intros have a logo and portable document links', () => {
  assert.ok(existsSync(new URL('../assets/gitifact-logo.svg', import.meta.url)));
  for (const language of ['ko', 'en']) {
    const intro = read('../' + language + '/intro.md');
    assert.match(intro, /^<p align="center">\n  <img src="[^"]+" alt="GITIFACT" width="720" \/>\n<\/p>/);
    for (const [, link] of intro.matchAll(/\]\(([^)]+)\)/g)) assert.match(link, /^https:\/\//);
  }
});
