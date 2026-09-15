import childProcess from 'node:child_process';
import fsPromises from 'node:fs/promises';
import { writeFileSync } from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { performance } from 'node:perf_hooks';

// Preload for scripts/benchmark-commit.mjs: node --import <this> dist/main.js ...
// Records Git process and file access timing without changing the CLI bundle or its stdout.
// Only command names, Git subcommands and caller function names are written, never file contents or env.
const target = process.env.TRYCE_BENCH_TRACE;
if (target) {
  const loadedAt = performance.now();
  const git = [];
  const fs = {};
  const callers = () => {
    const limit = Error.stackTraceLimit; Error.stackTraceLimit = 40;
    const stack = new Error().stack ?? ''; Error.stackTraceLimit = limit;
    const names = [];
    for (const line of stack.split('\n').slice(1)) {
      const match = /at (?:async )?(?:Object\.)?([\w$.]+) \(.*main\.js:\d+/.exec(line);
      if (!match || ['Promise', 'new Promise', 'runner', 'spawn', 'childProcess.spawn'].includes(match[1])) continue;
      if (names.at(-1) !== match[1]) names.push(match[1]);
    }
    return names.slice(0, 5).join(' < ');
  };
  const subcommand = args => {
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '-c') { i++; continue; }
      if (!String(args[i]).startsWith('-')) return String(args[i]);
    }
    return '(none)';
  };
  const spawn = childProcess.spawn;
  childProcess.spawn = function (command, args, options) {
    const began = performance.now();
    const child = spawn.apply(this, arguments);
    if (/(^|[\\/])git(\.exe)?$/i.test(String(command))) {
      const entry = { sub: subcommand(Array.isArray(args) ? args : []), caller: callers(), began, ended: null };
      git.push(entry);
      child.once('close', () => { entry.ended = performance.now(); });
    }
    return child;
  };
  for (const name of ['readFile', 'writeFile', 'lstat', 'stat', 'readdir', 'open', 'rename', 'mkdir', 'rmdir', 'unlink']) {
    const original = fsPromises[name];
    fsPromises[name] = async function (...args) {
      const began = performance.now();
      try { return await original.apply(this, args); }
      finally { const slot = fs[name] ??= { count: 0, ms: 0 }; slot.count++; slot.ms += performance.now() - began; }
    };
  }
  syncBuiltinESMExports();
  process.once('exit', code => {
    writeFileSync(target, JSON.stringify({ code, loadedAt, exitAt: performance.now(), git, fs }));
  });
}
