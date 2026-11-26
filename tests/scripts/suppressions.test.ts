import { describe, expect, it } from 'vitest';
import { findSuppressions, main } from '../../scripts/suppressions.ts';
import { fakeIo } from './fake-io.ts';

// The banned words are assembled here so this file does not trip the check it tests.
const ESLINT_OFF = ['eslint', 'disable'].join('-');
const TS_IGNORE = ['@ts', 'ignore'].join('-');
const TS_EXPECT = ['@ts', 'expect', 'error'].join('-');
const TS_NOCHECK = ['@ts', 'nocheck'].join('-');
const V8_IGNORE = ['v8', 'ignore'].join(' ');
const SEMGREP_OFF = ['no', 'semgrep'].join('');
const GITLEAKS_ALLOW = ['gitleaks', 'allow'].join(':');
const SKIP = ['.', 'skip'].join('');
const ONLY = ['.', 'only'].join('');
const TODO = ['.', 'todo'].join('');
const C8_IGNORE = ['c8', 'ignore'].join(' ');
const ISTANBUL_IGNORE = ['istanbul', 'ignore'].join(' ');
const X = 'x';

function diff(file: string, added: string[], removed: string[] = [], deleted = false): string {
  return [
    `diff --git a/${file} b/${file}`,
    deleted ? 'deleted file mode 100644' : `index 111..222 100644`,
    `--- a/${file}`,
    deleted ? '+++ /dev/null' : `+++ b/${file}`,
    '@@ -1 +1 @@',
    ...removed.map((line) => `-${line}`),
    ...added.map((line) => `+${line}`),
    '',
  ].join('\n');
}

const rules = (text: string): string[] => findSuppressions(text).map((f) => f.rule);

describe('new suppressions in code', () => {
  it.each([
    [`// ${ESLINT_OFF}-next-line no-console`, 'eslint-suppression'],
    [`/* ${ESLINT_OFF} */`, 'eslint-suppression'],
    [`// ${TS_IGNORE}`, 'ts-suppression'],
    [`// ${TS_EXPECT} reason`, 'ts-suppression'],
    [`// ${TS_NOCHECK}`, 'ts-suppression'],
    [`/* ${V8_IGNORE} next */`, 'coverage-ignore'],
    [`// ${C8_IGNORE} next`, 'coverage-ignore'],
    [`/* ${ISTANBUL_IGNORE} next */`, 'coverage-ignore'],
    [`// ${SEMGREP_OFF}: rule-id`, 'scanner-suppression'],
    [`const key = 'x'; // ${GITLEAKS_ALLOW}`, 'scanner-suppression'],
  ])('flags %s', (line, rule) => {
    expect(rules(diff('src/a.ts', [line]))).toEqual([rule]);
  });

  it.each(['src/a.ts', 'src/a.tsx', 'src/a.js', 'src/a.mjs', 'src/a.cjs', 'src/a.mts', 'src/a.cts'])(
    'checks code in %s',
    (file) => {
      expect(rules(diff(file, [`// ${TS_IGNORE}`]))).toEqual(['ts-suppression']);
    },
  );

  it('does not read documentation for code suppressions', () => {
    expect(rules(diff('README.md', [`Do not use ${ESLINT_OFF} or ${TS_IGNORE}.`]))).toEqual([]);
  });

  it('flags scanner suppressions in any file type', () => {
    expect(rules(diff('config.yml', [`# ${SEMGREP_OFF}`]))).toEqual(['scanner-suppression']);
    expect(rules(diff('notes.txt', [GITLEAKS_ALLOW]))).toEqual(['scanner-suppression']);
  });

  it('ignores removed lines and unchanged text', () => {
    expect(rules(diff('src/a.ts', [], [`// ${TS_IGNORE}`]))).toEqual([]);
  });

  it('does not take the +++ header for an added line', () => {
    const text = `diff --git a/src/a.ts b/src/a.ts\n--- a/src/a.ts\n+++ b/src/${TS_IGNORE}.ts\n`;
    expect(findSuppressions(text)).toEqual([]);
  });

  it('reports the file, the added text and the rule', () => {
    const [finding] = findSuppressions(diff('src/a.ts', [`// ${TS_IGNORE}`]));
    expect(finding).toEqual({ file: 'src/a.ts', rule: 'ts-suppression', text: `// ${TS_IGNORE}` });
  });
});

describe('skipped and deleted tests', () => {
  it.each([
    `it${SKIP}('a', () => {});`,
    `  test${SKIP}('a', () => {});`,
    `describe${SKIP}('a', () => {});`,
    `it${TODO}('a');`,
    `it${ONLY}('a', () => {});`,
    `${X}it('a', () => {});`,
    `${X}describe('a', () => {});`,
    `${X}test('a', () => {});`,
    `it${SKIP}If(cond)('a', () => {});`,
  ])('flags %s in a test file', (line) => {
    expect(rules(diff('tests/a.test.ts', [line]))).toEqual(['skipped-test']);
  });

  it('flags a skip in tests/ and in *.test.ts files outside tests/', () => {
    expect(rules(diff('tests/helper.ts', [`it${SKIP}('a', f);`]))).toEqual(['skipped-test']);
    expect(rules(diff('src/a.test.ts', [`it${SKIP}('a', f);`]))).toEqual(['skipped-test']);
  });

  it('does not flag a skip outside test files', () => {
    expect(rules(diff('src/a.ts', [`list${SKIP}(3);`]))).toEqual([]);
  });

  it('flags a deleted test', () => {
    const text = diff('tests/a.test.ts', [], [`it('keeps the total', () => {`, `  expect(1).toBe(1);`, `});`]);
    const found = findSuppressions(text);
    expect(found.map((f) => f.rule)).toEqual(['deleted-test']);
    expect(found[0]?.text).toBe('keeps the total');
  });

  it.each([
    [`test("double quotes", () => {`, 'double quotes'],
    [`  it.each([[1, 2]])('table %i', (a) => {`, 'table %i'],
    ['  it(`template`, () => {', 'template'],
  ])('reads the title in %s', (line, title) => {
    expect(findSuppressions(diff('tests/a.test.ts', [], [line]))[0]?.text).toBe(title);
  });

  it('does not flag a renamed or moved test whose title is still added', () => {
    const text =
      diff('tests/a.test.ts', [], [`it('moves', () => {`]) +
      diff('tests/b.test.ts', [`it('moves', () => {`]);
    expect(rules(text)).toEqual([]);
  });

  it('flags a test removed while another test with a different title is added', () => {
    const text =
      diff('tests/a.test.ts', [`it('new', () => {`], [`it('old', () => {`]);
    expect(rules(text)).toEqual(['deleted-test']);
  });

  it('counts duplicates: two removed, one added is one deleted', () => {
    const text = diff('tests/a.test.ts', [`it('same', f);`], [`it('same', f);`, `it('same', f);`]);
    expect(rules(text)).toEqual(['deleted-test']);
  });

  it('flags a deleted test file even when no title can be read', () => {
    const text = diff('tests/a.test.ts', [], ['// nothing readable'], true);
    expect(rules(text)).toEqual(['deleted-test-file']);
  });

  it('does not flag a deleted file outside the tests', () => {
    expect(rules(diff('src/a.ts', [], ['export const a = 1;'], true))).toEqual([]);
  });

  it('does not flag an ordinary new test', () => {
    expect(rules(diff('tests/a.test.ts', [`it('new', () => {`]))).toEqual([]);
  });
});

describe('main', () => {
  it('passes on a clean diff and reads the diff from git without rename detection', () => {
    const io = fakeIo({
      git: (args) => {
        expect(args).toEqual(['diff', '--no-renames', '-U0', '--no-color', 'origin/main...HEAD']);
        return diff('src/a.ts', ['export const a = 1;']);
      },
    });
    expect(main(['--base', 'origin/main'], io)).toBe(0);
    expect(io.stdout.join('\n')).toContain('No new suppressions');
  });

  it('fails and lists each finding', () => {
    const io = fakeIo({ stdin: diff('src/a.ts', [`// ${TS_IGNORE}`]) });
    expect(main([], io)).toBe(1);
    expect(io.stderr.join('\n')).toContain('src/a.ts');
    expect(io.stderr.join('\n')).toContain('ts-suppression');
  });

  it('exits 2 when git fails', () => {
    const io = fakeIo({
      git: () => {
        throw new Error('bad ref');
      },
    });
    expect(main(['--base', 'x'], io)).toBe(2);
    expect(io.stderr.join('\n')).toContain('bad ref');
  });

  it('exits 2 when --base has no value', () => {
    const io = fakeIo();
    expect(main(['--base'], io)).toBe(2);
  });
});
