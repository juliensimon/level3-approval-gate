import picomatch from 'picomatch';
import { errorMessage, type Io } from './io.ts';

export type Lane = 'green' | 'amber' | 'red';

export interface LaneConfig {
  ruleVersion: string;
  green: readonly string[];
  red: readonly string[];
}

export interface FileLane {
  path: string;
  lane: Lane;
}

export interface ChangeLane {
  lane: Lane;
  ruleVersion: string;
  files: FileLane[];
}

const STRICTNESS: Record<Lane, number> = { green: 0, amber: 1, red: 2 };

/** Hidden paths are matched like any other, and letter case never decides a lane. */
const MATCH_OPTIONS = { dot: true, nocase: true };

/** Returns a clean repository-relative path, or null when the path cannot be trusted. */
export function normalizePath(path: string): string | null {
  const trimmed = path.startsWith('./') ? path.slice(2) : path;
  const unsafe = ['', '.', '..'];
  if (trimmed.includes('\\') || trimmed.split('/').some((segment) => unsafe.includes(segment))) {
    return null;
  }
  return trimmed;
}

function matches(patterns: readonly string[], path: string): boolean {
  return picomatch.isMatch(path, [...patterns], MATCH_OPTIONS);
}

/**
 * Red wins over green. A path the classifier cannot read is red. So is any dotfile or
 * dot-directory at the repository root that no rule names, because tools read those
 * files as configuration.
 */
export function classifyFile(path: string, config: LaneConfig): Lane {
  const clean = normalizePath(path);
  if (clean === null || clean.startsWith('.') || matches(config.red, clean)) {
    return 'red';
  }
  return matches(config.green, clean) ? 'green' : 'amber';
}

/** A change takes the strictest lane of its files. A change with no files goes to a person. */
export function classifyChange(paths: readonly string[], config: LaneConfig): ChangeLane {
  const files = paths.map((path) => ({ path, lane: classifyFile(path, config) }));
  const strictestFirst = files.map((file) => file.lane).sort((a, b) => STRICTNESS[b] - STRICTNESS[a]);
  return { lane: strictestFirst[0] ?? 'amber', ruleVersion: config.ruleVersion, files };
}

interface Args {
  base?: string;
  json: boolean;
  files: string[];
}

function parseArgs(argv: readonly string[]): Args | string {
  const args: Args = { json: false, files: [] };
  let skipNext = false;
  for (const [i, arg] of argv.entries()) {
    if (skipNext) {
      skipNext = false;
    } else if (arg === '--json') {
      args.json = true;
    } else if (arg === '--base') {
      const value = argv[i + 1];
      if (value === undefined) {
        return '--base needs a value.';
      }
      args.base = value;
      skipNext = true;
    } else {
      args.files.push(arg);
    }
  }
  return args;
}

function changedFiles(args: Args, io: Io): string[] {
  if (args.base === undefined) {
    return args.files;
  }
  if (args.files.length > 0) {
    throw new Error('Give file names or --base, not both.');
  }
  const raw = io.git(['diff', '-z', '--name-only', '--no-renames', `${args.base}...HEAD`]);
  return raw.split('\0').filter((name) => name !== '');
}

export function main(argv: readonly string[], io: Io): number {
  const args = parseArgs(argv);
  if (typeof args === 'string') {
    io.err(args);
    return 2;
  }
  try {
    const config = JSON.parse(io.readFile('gate/lanes.json')) as LaneConfig;
    const result = classifyChange(changedFiles(args, io), config);
    io.out(args.json ? JSON.stringify(result, null, 2) : result.lane);
    return 0;
  } catch (error) {
    io.err(errorMessage(error));
    return 2;
  }
}
