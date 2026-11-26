/**
 * Entry point for the gate scripts: `tsx scripts/cli.ts <script> [args]`.
 * This file only wires the real shell, files and clock into each script's main().
 * It holds no rules, and vitest leaves it out of coverage.
 */
import { spawnSync, execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Io } from './io.ts';
import { main as audit } from './audit.ts';
import { main as diffCoverage } from './diff-coverage.ts';
import { main as lane } from './lane.ts';
import { main as ratchet } from './ratchet.ts';
import { main as suppressions } from './suppressions.ts';

const root = join(import.meta.dirname, '..');

const io: Io = {
  out: (line) => {
    console.log(line);
  },
  err: (line) => {
    console.error(line);
  },
  readFile: (path) => readFileSync(join(root, path), 'utf8'),
  writeFile: (path, content) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  },
  git: (args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }),
  readStdin: () => readFileSync(0, 'utf8'),
  run: (command, args) => {
    const result = spawnSync(command, args, { cwd: root, stdio: 'inherit' });
    if (result.error) {
      throw result.error;
    }
    return result.status ?? 1;
  },
  env: (name) => process.env[name],
  now: () => new Date(),
};

const scripts: Record<string, (argv: readonly string[], io: Io) => number> = {
  lane,
  suppressions,
  ratchet,
  'diff-coverage': diffCoverage,
  audit,
};

const [name, ...rest] = process.argv.slice(2);
const script = name === undefined ? undefined : scripts[name];
if (script === undefined) {
  console.error(`Usage: cli.ts <${Object.keys(scripts).join('|')}> [args]`);
  process.exitCode = 2;
} else {
  process.exitCode = script(rest, io);
}
