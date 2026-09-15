import { spawn, spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync, appendFileSync } from 'node:fs';
import os from 'node:os';
import { join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Commit flow benchmark in independent fixture repositories. Never touches the current checkout.
// Build or choose a CLI first. Run: node scripts/benchmark-commit.mjs [--cli path] [--runs 5] [--case small,medium,many,tryce] [--flow both|legacy|merged] [--work dir] [--keep]
const option = (name, fallback) => { const i = process.argv.indexOf('--' + name); return i < 0 ? fallback : process.argv[i + 1]; };
const repoRoot = fileURLToPath(new URL('../', import.meta.url));
const cli = resolve(option('cli', join(repoRoot, 'apps/cli/dist/main.js')));
const runs = Number(option('runs', '5'));
const selectedCases = option('case', 'small,medium,many,tryce').split(',');
const label = new Date().toISOString().replace(/[:.]/g, '-');
const base = resolve(option('work', join(repoRoot, '.tmp/commit-performance/work')), label);
const out = resolve(option('out', join(repoRoot, '.tmp/commit-performance', `results-${label}.json`)));
const keep = process.argv.includes('--keep');
// legacy: working → changes → prepare → commit-plan → commit-apply. merged: spec commit (needs a CLI that has it).
const flow = option('flow', 'both');
const flows = { legacy: flow !== 'merged', merged: flow !== 'legacy' };
const tracer = pathToFileURL(fileURLToPath(new URL('./benchmark-commit-trace.mjs', import.meta.url))).href;
const inputs = join(base, 'inputs');
mkdirSync(inputs, { recursive: true });
const authorization = { basis: 'user-request', evidence: 'Benchmark fixture commit' };
const log = message => process.stderr.write(message + '\n');

const git = (cwd, args) => {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${r.stderr}`);
  return r.stdout;
};
const writeInput = value => { const path = join(inputs, randomUUID() + '.json'); writeFileSync(path, JSON.stringify(value)); return path; };
function timed(command, args, cwd, env = process.env) {
  return new Promise((done, reject) => {
    const began = performance.now();
    const child = spawn(command, args, { cwd, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    const stdout = []; const stderr = [];
    child.stdout.on('data', c => stdout.push(c)); child.stderr.on('data', c => stderr.push(c));
    child.once('error', reject);
    child.once('close', code => {
      const wallMs = performance.now() - began;
      if (code !== 0) reject(new Error(`${args.join(' ')} exited ${code}: ${Buffer.concat(stderr)}`));
      else done({ wallMs, stdout: Buffer.concat(stdout).toString('utf8') });
    });
  });
}
async function tryce(cwd, args, trace = false) {
  const traceFile = trace ? join(inputs, 'trace-' + randomUUID() + '.json') : null;
  const { wallMs, stdout } = await timed(process.execPath, [...(trace ? ['--import', tracer] : []), cli, ...args], cwd,
    traceFile ? { ...process.env, TRYCE_BENCH_TRACE: traceFile } : process.env);
  const result = stdout.trim() && args[0] === 'spec' ? JSON.parse(stdout) : stdout;
  return { result, wallMs, trace: traceFile ? summarize(JSON.parse(readFileSync(traceFile, 'utf8'))) : undefined };
}
function summarize(trace) {
  const calls = trace.git.filter(g => g.ended !== null);
  let union = 0; let current = null;
  for (const [start, end] of calls.map(g => [g.began, g.ended]).sort((a, b) => a[0] - b[0])) {
    if (!current || start > current[1]) { if (current) union += current[1] - current[0]; current = [start, end]; }
    else current[1] = Math.max(current[1], end);
  }
  if (current) union += current[1] - current[0];
  const group = key => Object.fromEntries(Object.entries(calls.reduce((map, g) => {
    const slot = map[g[key]] ??= { count: 0, ms: 0 }; slot.count++; slot.ms += g.ended - g.began; return map;
  }, {})).sort((a, b) => b[1].ms - a[1].ms).map(([k, v]) => [k, { count: v.count, ms: Math.round(v.ms) }]));
  return {
    processMs: trace.exitAt, preloadMs: trace.loadedAt, firstGitMs: calls[0]?.began ?? null,
    gitCount: calls.length, gitSumMs: calls.reduce((n, g) => n + g.ended - g.began, 0), gitUnionMs: union,
    bySub: group('sub'), byCaller: group('caller'),
    fs: Object.fromEntries(Object.entries(trace.fs).map(([k, v]) => [k, { count: v.count, ms: Math.round(v.ms) }])),
  };
}

const body = (label, version) => `${label} 요청을 처리합니다. 변경 ${version}.\n\n### 수용 조건\n\n1. 조건: 사용자가 ${label}을 요청합니다.\n   기대 동작: 시스템은 입력을 검증하고 결과를 표시합니다.\n2. 조건: 입력이 올바르지 않습니다.\n   기대 동작: 시스템은 안내를 표시하고 저장을 중단합니다.`;
const history = path => path.replace(/requirements\.md$/, 'history.jsonl');
async function save(repo, operations) {
  const working = (await tryce(repo, ['spec', 'working'])).result;
  return (await tryce(repo, ['spec', 'save', '--file', writeInput({ expected: working.stamp, operations })])).result;
}
async function commitSpecs(repo, reasons, paths, message) {
  const changes = (await tryce(repo, ['spec', 'changes'])).result;
  const prepared = (await tryce(repo, ['spec', 'prepare', '--file', writeInput({ expected: changes.expected, reasons })])).result;
  const planned = (await tryce(repo, ['spec', 'commit-plan', '--file', writeInput({ verification: prepared.verification, paths, message, authorization })])).result;
  await tryce(repo, ['spec', 'commit-apply', '--file', writeInput(planned.plan)]);
}
const configure = repo => {
  git(repo, ['config', 'user.name', 'Tryce benchmark']); git(repo, ['config', 'user.email', 'benchmark@example.invalid']);
  git(repo, ['config', 'commit.gpgsign', 'false']);
};

async function syntheticTemplate(name, { specs, requirements, tracked, rounds }) {
  const repo = join(base, 'templates', name); mkdirSync(repo, { recursive: true });
  git(repo, ['init', '-q', '-b', 'main']); configure(repo);
  const code = [];
  for (let i = 0; i < tracked; i++) {
    const path = `src/group-${Math.floor(i / 50)}/module-${i}.js`; code.push(path);
    mkdirSync(join(repo, `src/group-${Math.floor(i / 50)}`), { recursive: true });
    writeFileSync(join(repo, path), Array.from({ length: 30 }, (_, n) => `export const value${n} = ${i * 100 + n};`).join('\n') + '\n');
  }
  writeFileSync(join(repo, 'README.md'), '# Benchmark fixture\n');
  git(repo, ['add', '-A']); git(repo, ['commit', '-q', '-m', 'Add source']);
  await tryce(repo, ['init']); git(repo, ['add', '.tryce/config.json']); git(repo, ['commit', '-q', '-m', 'Initialize tryce']);
  const meta = { code, specs: [] };
  for (let s = 0; s < specs; s++) {
    const feature = `area-${s + 1}`;
    const result = await save(repo, [{ type: 'create', feature, title: `영역 ${s + 1}` },
      ...Array.from({ length: requirements }, (_, r) => ({ type: 'add', feature, title: `요구사항 ${s + 1}-${r + 1}`, body: body(`요구사항 ${s + 1}-${r + 1}`, 0) }))]);
    meta.specs.push({ path: `.tryce/spec/${feature}/requirements.md`,
      requirements: result.results.slice(1).map((x, r) => ({ id: x.id, title: `요구사항 ${s + 1}-${r + 1}` })) });
  }
  await commitSpecs(repo, meta.specs.map(sp => ({ requirements: sp.requirements.map(r => r.id), reason: `${sp.path} 초기 요구사항` })),
    meta.specs.flatMap(sp => [sp.path, history(sp.path)]), 'Add initial specifications');
  for (let round = 1; round <= rounds; round++) {
    const touched = meta.specs.slice(0, Math.min(5, meta.specs.length));
    await save(repo, touched.map(sp => ({ type: 'update', id: sp.requirements[0].id, title: sp.requirements[0].title, body: body(sp.requirements[0].title, round) })));
    await commitSpecs(repo, touched.map(sp => ({ requirements: [sp.requirements[0].id], reason: `라운드 ${round} 변경` })),
      touched.flatMap(sp => [sp.path, history(sp.path)]), `Update specifications round ${round}`);
  }
  return { repo, meta };
}
async function tryceTemplate() {
  const repo = join(base, 'templates', 'tryce');
  // Match the LF working tree of the source checkout. The deprecated commit-plan still rejects CRLF checkouts.
  git(base, ['clone', '-q', '--no-hardlinks', '-c', 'core.autocrlf=false', repoRoot, repo]); configure(repo);
  const working = (await tryce(repo, ['spec', 'working'])).result;
  const code = git(repo, ['ls-files', '-z', '--', 'docs', 'apps/cli/src']).split('\0').filter(p => /\.(md|ts)$/.test(p));
  return { repo, meta: { code, specs: working.specs.map(s => ({ path: s.path, requirements: s.requirements.map(r => ({ id: r.id, title: r.title, body: r.body })) })) } };
}

const cases = {
  small: { template: 'small', specChanges: 1, codeFiles: 2 },
  medium: { template: 'medium', specChanges: 3, codeFiles: 20 },
  many: { template: 'medium', specChanges: 3, codeFiles: 118 },
  tryce: { template: 'tryce', specChanges: 1, codeFiles: 5 },
};
const templateShapes = { small: { specs: 1, requirements: 3, tracked: 10, rounds: 1 }, medium: { specs: 20, requirements: 8, tracked: 2000, rounds: 3 } };
const templates = {};
const records = [];
const environment = {
  date: new Date().toISOString(), platform: `${os.platform()} ${os.release()}`, cpu: os.cpus()[0]?.model, cores: os.cpus().length,
  node: process.version, git: git(repoRoot, ['--version']).trim(), cli, cliSha256: createHash('sha256').update(readFileSync(cli)).digest('hex'),
  runs, flow, fixtureConfig: 'commit.gpgsign=false, no hooks installed, system core.autocrlf inherited',
  autocrlf: spawnSync('git', ['config', '--get', 'core.autocrlf'], { encoding: 'utf8' }).stdout.trim() || '(unset)',
};
log(JSON.stringify(environment));

// Fixed process costs, measured once in this environment.
for (let i = 0; i < 10; i++) records.push({ case: 'process', kind: 'spawn', step: 'git --version', iteration: i, wallMs: (await timed('git', ['--version'], base)).wallMs });
for (let i = 0; i < runs; i++) records.push({ case: 'process', kind: 'spawn', step: 'tryce --version', iteration: i, wallMs: (await timed(process.execPath, [cli, '--version'], base)).wallMs });

const failures = [];
const persist = () => writeFileSync(out, JSON.stringify({ environment, failures, records }, null, 2));
for (const name of selectedCases) {
  const spec = cases[name]; if (!spec) throw new Error('Unknown case ' + name);
  try { await runCase(name, spec); } catch (error) { failures.push({ case: name, message: String(error.message ?? error) }); log(`${name} failed: ${error.message}`); }
  persist();
}
async function runCase(name, spec) {
  if (!templates[spec.template]) {
    log(`preparing template ${spec.template}`);
    templates[spec.template] = spec.template === 'tryce' ? await tryceTemplate() : await syntheticTemplate(spec.template, templateShapes[spec.template]);
  }
  const { repo: template, meta } = templates[spec.template];
  for (let iteration = 0; iteration < runs; iteration++) {
    for (const kind of ['spec', 'code']) {
      const dir = join(base, 'runs', `${name}-${kind}-${iteration}`);
      cpSync(template, dir, { recursive: true });
      git(dir, ['update-index', '-q', '--refresh']);
      // Fixture mutation (not measured): edit requirements through the CLI and append to code files.
      const touched = kind === 'spec' ? meta.specs.slice(0, spec.specChanges) : [];
      if (touched.length) await save(dir, touched.map(sp => ({ type: 'update', id: sp.requirements[0].id, title: sp.requirements[0].title, body: body(sp.requirements[0].title, `run-${iteration}`) })));
      const codeFiles = meta.code.slice(0, spec.codeFiles);
      for (const path of codeFiles) appendFileSync(join(dir, path), `\n// benchmark ${kind} ${iteration}\n`);
      const plain = dir + '-git'; const single = dir + '-commit';
      for (const copy of [plain, ...(flows.merged ? [single] : [])]) { cpSync(dir, copy, { recursive: true }); git(copy, ['update-index', '-q', '--refresh']); }
      git(dir, ['update-index', '-q', '--refresh']);
      const record = (step, measured) => records.push({ case: name, kind, iteration, step, wallMs: measured.wallMs, ...(measured.trace ?? {}) });
      const reasons = touched.length ? [{ requirements: touched.map(sp => sp.requirements[0].id), reason: '벤치마크 변경 이유' }] : [];
      const paths = [...touched.flatMap(sp => [sp.path, history(sp.path)]), ...codeFiles];
      const commitInput = { paths, message: `Benchmark ${kind} commit`, authorization, ...(kind === 'code' ? { requirements: [meta.specs[0].requirements[0].id] } : {}) };
      const progress = [];

      const status = await timed('git', ['status', '--porcelain=v2', '--untracked-files=all', '-z'], dir); record('git status (reference)', status);
      if (flows.legacy) {
        const working = await tryce(dir, ['spec', 'working'], true); record('working', working);
        const changes = await tryce(dir, ['spec', 'changes'], true); record('changes', changes);
        const prepared = await tryce(dir, ['spec', 'prepare', '--file', writeInput({ expected: changes.result.expected, reasons })], true); record('prepare', prepared);
        const planned = await tryce(dir, ['spec', 'commit-plan', '--file', writeInput({ verification: prepared.result.verification, ...commitInput })], true); record('commit-plan', planned);
        const applied = await tryce(dir, ['spec', 'commit-apply', '--file', writeInput(planned.result.plan)], true); record('commit-apply', applied);
        if (applied.result.outcome !== 'committed' || applied.result.paths.length !== paths.length) throw new Error('Unexpected commit result: ' + JSON.stringify(applied.result));
        progress.push(`4-step flow ${Math.round(working.wallMs + changes.wallMs + prepared.wallMs + planned.wallMs + applied.wallMs)}ms`);
      }
      if (flows.merged) {
        const committed = await tryce(single, ['spec', 'commit', '--file', writeInput({ reasons, ...commitInput })], true); record('commit (single)', committed);
        if (committed.result.outcome !== 'committed' || committed.result.paths.length !== paths.length) throw new Error('Unexpected commit result: ' + JSON.stringify(committed.result));
        progress.push(`single commit ${Math.round(committed.wallMs)}ms`);
      }

      const plainPaths = [...touched.map(sp => sp.path), ...codeFiles];
      const add = await timed('git', ['add', '--', ...plainPaths], plain); const commit = await timed('git', ['commit', '-q', '-m', `Plain ${kind} commit`], plain);
      records.push({ case: name, kind, iteration, step: 'plain git add+commit', wallMs: add.wallMs + commit.wallMs, gitCount: 2 });
      if (!keep) for (const path of [dir, plain, single]) rmSync(path, { recursive: true, force: true, maxRetries: 3 });
      log(`${name} ${kind} #${iteration}: ${progress.join(', ')}, plain git ${Math.round(add.wallMs + commit.wallMs)}ms`);
    }
  }
}

const median = values => { const s = [...values].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const round = value => value === undefined || value === null ? null : Math.round(value);
const summary = [];
const keys = [...new Set(records.map(r => `${r.case}|${r.kind}|${r.step}`))];
for (const key of keys) {
  const [caseName, kind, step] = key.split('|');
  const rows = records.filter(r => r.case === caseName && r.kind === kind && r.step === step);
  const repeat = rows.length > 1 ? rows.slice(1) : rows;
  summary.push({ case: caseName, kind, step, runs: rows.length, firstMs: round(rows[0].wallMs), medianMs: round(median(repeat.map(r => r.wallMs))),
    minMs: round(Math.min(...repeat.map(r => r.wallMs))), maxMs: round(Math.max(...repeat.map(r => r.wallMs))),
    gitCount: rows[0].gitCount ?? null, gitUnionMedianMs: rows[0].gitUnionMs === undefined ? null : round(median(repeat.map(r => r.gitUnionMs))),
    processMedianMs: rows[0].processMs === undefined ? null : round(median(repeat.map(r => r.processMs))) });
}
if (flows.legacy) for (const caseName of selectedCases) for (const kind of ['spec', 'code']) {
  const flows = Array.from({ length: runs }, (_, i) => records.filter(r => r.case === caseName && r.kind === kind && r.iteration === i && ['working', 'changes', 'prepare', 'commit-plan', 'commit-apply'].includes(r.step)));
  const totals = flows.map(f => f.reduce((n, r) => n + r.wallMs, 0)); const gits = flows.map(f => f.reduce((n, r) => n + r.gitCount, 0));
  const repeat = totals.length > 1 ? totals.slice(1) : totals;
  summary.push({ case: caseName, kind, step: 'TOTAL tryce flow', runs, firstMs: round(totals[0]), medianMs: round(median(repeat)), minMs: round(Math.min(...repeat)), maxMs: round(Math.max(...repeat)), gitCount: gits[0] });
}
writeFileSync(out, JSON.stringify({ environment, failures, summary, records }, null, 2));
console.table(summary.map(({ runs: _, ...row }) => row));
log('results: ' + out);
if (!keep) rmSync(join(base, 'runs'), { recursive: true, force: true, maxRetries: 3 });
