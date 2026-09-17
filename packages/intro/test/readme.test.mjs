import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, readFileSync } from 'node:fs';

// Until an English README and the gitifact.xyz site exist, README.md is a copy of the Korean intro, logo included.
// The copy is allowed only while it stays identical; drop this test when README.md becomes the short English page.
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const intro = read('../ko/intro.md');

test('README.md is the Korean intro verbatim', () => {
  assert.equal(read('../../../README.md'), intro, 'Copy packages/intro/ko/intro.md into README.md.');
});

test('the intro opens with the logo, which lives in this package', () => {
  const logo = /^<p align="center">\n  <img src="([^"]+)" alt="GITIFACT" width="720" \/>\n<\/p>\n\n/.exec(intro);
  assert.ok(logo, 'The intro must start with the centered logo block.');
  // The path is relative to the repository root, where README.md reads it.
  assert.equal(logo[1], 'packages/intro/assets/gitifact-logo.svg');
  assert.ok(existsSync(new URL('../../../' + logo[1], import.meta.url)));
});

test('the intro uses absolute links so it reads the same on GitHub, the site and the browser', () => {
  const links = [...intro.matchAll(/\]\(([^)]+)\)/g)].map(match => match[1]);
  assert.ok(links.length > 0);
  for (const link of links) assert.match(link, /^https:\/\//, link);
});
