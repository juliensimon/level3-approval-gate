import { errorMessage, type Io } from './io.ts';

export interface Finding {
  file: string;
  rule: string;
  text: string;
}

const CODE_FILE = /\.(?:[cm]?[jt]s|[jt]sx)$/;
const TEST_FILE = /(?:^|\/)tests?\/|\.(?:test|spec)\.[cm]?[jt]sx?$/;

/** Patterns for suppression comments. They need a comment opener so prose and regex literals do not match. */
const CODE_RULES: readonly (readonly [string, RegExp])[] = [
  ['eslint-suppression', /(?:\/\/|\/\*)\s*eslint-disable/],
  ['ts-suppression', /@ts-(?:ignore|nocheck|expect-error)/],
  ['coverage-ignore', /(?:\/\/|\/\*)\s*(?:v8|c8|istanbul)\s+ignore/],
];

const ANY_FILE_RULES: readonly (readonly [string, RegExp])[] = [
  ['scanner-suppression', /(?:\/\/|\/\*|#)\s*nosemgrep|gitleaks[:]allow/],
];

const SKIPPED_TEST =
  /\b(?:it|test|describe)\.(?:skip|todo|only|fixme|skipIf)\b|\b(?:xit|xtest|xdescribe)\s*\(/;

const TEST_TITLE = /^\s*(?:it|test)(?:\.[A-Za-z]+)*(?:\((?:[^()]|\([^()]*\))*\))?\(\s*(['"`])(.*?)\1/;

interface FileDiff {
  file: string;
  deleted: boolean;
  added: string[];
  removed: string[];
}

interface ParseState {
  current: FileDiff | undefined;
  oldPath: string;
  inHunk: boolean;
}

function applyHeader(line: string, state: ParseState, files: FileDiff[]): void {
  if (line.startsWith('--- ')) {
    state.oldPath = line.slice(4).replace(/^a\//, '');
  } else if (line.startsWith('+++ ')) {
    const deleted = line === '+++ /dev/null';
    const file = deleted ? state.oldPath : line.slice(4).replace(/^b\//, '');
    state.current = { file, deleted, added: [], removed: [] };
    files.push(state.current);
  }
}

function applyLine(line: string, state: ParseState, files: FileDiff[]): void {
  if (line.startsWith('diff --git ')) {
    state.inHunk = false;
    state.current = undefined;
  } else if (line.startsWith('@@')) {
    state.inHunk = true;
  } else if (!state.inHunk) {
    applyHeader(line, state, files);
  } else if (line.startsWith('+')) {
    state.current?.added.push(line.slice(1));
  } else if (line.startsWith('-')) {
    state.current?.removed.push(line.slice(1));
  }
}

function parseDiff(diff: string): FileDiff[] {
  const files: FileDiff[] = [];
  const state: ParseState = { current: undefined, oldPath: '', inHunk: false };
  for (const line of diff.split('\n')) {
    applyLine(line, state, files);
  }
  return files;
}

function titlesOf(lines: readonly string[]): string[] {
  return lines.flatMap((line) => TEST_TITLE.exec(line)?.[2] ?? []);
}

function suppressionsIn(file: FileDiff): Finding[] {
  const isCode = CODE_FILE.test(file.file);
  const isTest = TEST_FILE.test(file.file);
  const rules = [...(isCode ? CODE_RULES : []), ...ANY_FILE_RULES];
  return file.added.flatMap((line) => {
    const found = rules.filter(([, pattern]) => pattern.test(line)).map(([rule]) => rule);
    if (isTest && SKIPPED_TEST.test(line)) {
      found.push('skipped-test');
    }
    return found.map((rule) => ({ file: file.file, rule, text: line.trim() }));
  });
}

function deletedTests(files: readonly FileDiff[]): Finding[] {
  const tests = files.filter((file) => TEST_FILE.test(file.file));
  const balance = new Map<string, { file: string; count: number }>();
  for (const file of tests) {
    for (const title of titlesOf(file.removed)) {
      const entry = balance.get(title) ?? { file: file.file, count: 0 };
      balance.set(title, { file: entry.file, count: entry.count + 1 });
    }
  }
  for (const file of tests) {
    for (const title of titlesOf(file.added)) {
      const entry = balance.get(title);
      if (entry !== undefined) {
        balance.set(title, { file: entry.file, count: entry.count - 1 });
      }
    }
  }
  const missing = [...balance].flatMap(([title, { file, count }]) =>
    count > 0 ? Array.from({ length: count }, () => ({ file, rule: 'deleted-test', text: title })) : [],
  );
  const deletedFiles = tests
    .filter((file) => file.deleted)
    .map((file) => ({ file: file.file, rule: 'deleted-test-file', text: file.file }));
  return [...missing, ...deletedFiles];
}

/** Finds new suppressions, skipped tests and deleted tests in a unified diff. Only added and removed lines count. */
export function findSuppressions(diff: string): Finding[] {
  const files = parseDiff(diff);
  return [...files.flatMap(suppressionsIn), ...deletedTests(files)];
}

export function main(argv: readonly string[], io: Io): number {
  try {
    const flag = argv.indexOf('--base');
    if (flag !== -1 && argv[flag + 1] === undefined) {
      io.err('--base needs a value.');
      return 2;
    }
    const base = flag === -1 ? undefined : argv[flag + 1];
    const diff =
      base === undefined ? io.readStdin() : io.git(['diff', '--no-renames', '-U0', '--no-color', `${base}...HEAD`]);
    const findings = findSuppressions(diff);
    if (findings.length === 0) {
      io.out('No new suppressions, skipped tests or deleted tests.');
      return 0;
    }
    io.err(`${findings.length} suppression finding(s):`);
    for (const finding of findings) {
      io.err(`${finding.file}: ${finding.rule}: ${finding.text}`);
    }
    return 1;
  } catch (error) {
    io.err(errorMessage(error));
    return 2;
  }
}
