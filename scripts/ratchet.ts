import type { Io } from './io.ts';

export interface Baseline {
  limits: {
    coverage: { lines: number; functions: number; branches: number; statements: number };
    diffCoverage: number;
    complexity: { maxCyclomatic: number; maxFileLines: number; maxFunctionLines: number };
  };
}

type Direction = 'min' | 'max';

/** A minimum limit may only rise. A maximum limit may only fall. Every known limit is listed here. */
const DIRECTIONS: Record<string, Direction> = {
  'coverage.lines': 'min',
  'coverage.functions': 'min',
  'coverage.branches': 'min',
  'coverage.statements': 'min',
  diffCoverage: 'min',
  'complexity.maxCyclomatic': 'max',
  'complexity.maxFileLines': 'max',
  'complexity.maxFunctionLines': 'max',
};

function flatten(value: unknown, prefix = ''): Map<string, unknown> {
  const out = new Map<string, unknown>();
  if (typeof value !== 'object' || value === null) {
    return out;
  }
  for (const [key, child] of Object.entries(value)) {
    const path = prefix === '' ? key : `${prefix}.${key}`;
    if (typeof child === 'object' && child !== null) {
      for (const [childPath, leaf] of flatten(child, path)) {
        out.set(childPath, leaf);
      }
    } else {
      out.set(path, child);
    }
  }
  return out;
}

function isValid(path: string, value: unknown): value is number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return false;
  }
  return DIRECTIONS[path] === 'min' ? value <= 100 : Number.isInteger(value) && value >= 1;
}

/** Returns one message per limit that got looser, vanished or is not understood. An empty list means the ratchet holds. */
export function checkRatchet(base: Baseline, head: Baseline): string[] {
  const baseLimits = flatten(base.limits);
  const headLimits = flatten(head.limits);
  const problems: string[] = [];
  for (const [path, value] of headLimits) {
    const direction = DIRECTIONS[path];
    const before = baseLimits.get(path);
    if (direction === undefined) {
      problems.push(`${path} is unknown. Add its direction to scripts/ratchet.ts.`);
    } else if (!isValid(path, value)) {
      problems.push(`${path} is not a valid number.`);
    } else if (typeof before === 'number' && (direction === 'min' ? value < before : value > before)) {
      problems.push(`${path} was loosened from ${before} to ${value}.`);
    }
  }
  for (const path of baseLimits.keys()) {
    if (!headLimits.has(path)) {
      problems.push(`${path} was removed.`);
    }
  }
  return problems;
}

const BASELINE_PATH = 'gate/baseline.json';

export function main(argv: readonly string[], io: Io): number {
  const flag = argv.indexOf('--base');
  const ref = flag === -1 ? undefined : argv[flag + 1];
  if (ref === undefined) {
    io.err('Usage: ratchet --base <git ref>. --base needs a value.');
    return 2;
  }
  try {
    io.git(['rev-parse', '--verify', ref]);
    const head = JSON.parse(io.readFile(BASELINE_PATH)) as Baseline;
    if (io.git(['ls-tree', '--name-only', ref, BASELINE_PATH]).trim() === '') {
      io.out(`The base ${ref} has no baseline file yet, so there is nothing to compare.`);
      return 0;
    }
    const base = JSON.parse(io.git(['show', `${ref}:${BASELINE_PATH}`])) as Baseline;
    const problems = checkRatchet(base, head);
    if (problems.length === 0) {
      io.out('Ratchet holds: no limit got looser.');
      return 0;
    }
    for (const problem of problems) {
      io.err(problem);
    }
    return 1;
  } catch (error) {
    io.err(error instanceof Error ? error.message : String(error));
    return 2;
  }
}
