import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Existing fixtures assert Korean prose; localization tests override the language explicitly.
process.env.GITIFACT_LANG = 'ko';
// Release notices read and write a per-user cache; tests keep theirs in a folder of their own, never the user's.
const cache = mkdtempSync(join(tmpdir(), 'gitifact-cache-'));
process.env.GITIFACT_CACHE_DIR = cache;
// No test asks the real registry. Tests of the release check turn it back on with a fetch they supply.
process.env.GITIFACT_NO_UPDATE_CHECK = '1';
process.on('exit', () => rmSync(cache, { recursive: true, force: true }));
