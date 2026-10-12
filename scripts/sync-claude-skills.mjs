// Mirrors this repository's skills in .agents/skills into .claude/skills, where Claude Code finds them. The project's
// SessionStart hook (.claude/settings.json) runs it; .claude/skills is ignored by Git, so .agents/skills stays the one
// source. Only the folders it placed are replaced or removed: a skill someone keeps in .claude/skills alone is left.
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const source = join(root, '.agents', 'skills');
const target = join(root, '.claude', 'skills');
const record = join(target, '.mirrored.json');

const names = existsSync(source) ? readdirSync(source, { withFileTypes: true }).filter(e => e.isDirectory() && existsSync(join(source, e.name, 'SKILL.md'))).map(e => e.name) : [];
let placed = [];
try { placed = JSON.parse(readFileSync(record, 'utf8')); } catch { placed = []; }
mkdirSync(target, { recursive: true });
for (const name of placed) if (!names.includes(name)) rmSync(join(target, name), { recursive: true, force: true });
for (const name of names) {
  rmSync(join(target, name), { recursive: true, force: true });
  cpSync(join(source, name), join(target, name), { recursive: true });
}
writeFileSync(record, JSON.stringify(names) + '\n');
