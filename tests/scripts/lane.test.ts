import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import ignore from 'ignore';
import picomatch from 'picomatch';
import {
  classifyChange,
  classifyFile,
  main,
  normalizePath,
  type LaneConfig,
} from '../../scripts/lane.ts';
import { fakeIo } from './fake-io.ts';

const root = join(import.meta.dirname, '..', '..');
const config = JSON.parse(readFileSync(join(root, 'gate', 'lanes.json'), 'utf8')) as LaneConfig;

describe('normalizePath', () => {
  it.each([
    ['docs/internal/a.md', 'docs/internal/a.md'],
    ['./docs/internal/a.md', 'docs/internal/a.md'],
  ])('keeps %s as %s', (input, expected) => {
    expect(normalizePath(input)).toBe(expected);
  });

  it.each(['', '/etc/passwd', '../x.md', 'docs/../.github/x.yml', 'docs\\internal\\a.md', 'a/./b', 'a//b', 'docs/internal/', '//x'])(
    'rejects %j',
    (input) => {
      expect(normalizePath(input)).toBeNull();
    },
  );
});

describe('classifyFile', () => {
  it.each([
    ['docs/internal/runbook.md', 'green'],
    ['docs/internal/deep/er/notes.md', 'green'],
    ['docs/internal/.hidden.md', 'green'],
    ['src/invoice.ts', 'amber'],
    ['README.md', 'amber'],
    ['docs/aikido.md', 'amber'],
    ['docs/internal-notes.md', 'amber'],
    ['.github/workflows/gate.yml', 'red'],
    ['.github/CODEOWNERS', 'red'],
    ['CODEOWNERS', 'red'],
    ['docs/CODEOWNERS', 'red'],
    ['eslint.config.js', 'red'],
    ['eslint.complexity.config.js', 'red'],
    ['vitest.config.ts', 'red'],
    ['stryker.config.json', 'red'],
    ['stryker.ci.conf.mjs', 'red'],
    ['.npmrc', 'red'],
    ['.yarnrc', 'red'],
    ['.yarnrc.yml', 'red'],
    ['.nvmrc', 'red'],
    ['.node-version', 'red'],
    ['.husky/pre-commit', 'red'],
    ['.husky/_/husky.sh', 'red'],
    ['tsconfig.json', 'red'],
    ['tsconfig.build.json', 'red'],
    ['.dependency-cruiser.cjs', 'red'],
    ['osv-scanner.toml', 'red'],
    ['.gitleaks.toml', 'red'],
    ['.semgrep/rules.yml', 'red'],
    ['.semgrepignore', 'red'],
    ['gate/baseline.json', 'red'],
    ['gate/lanes.json', 'red'],
    ['scripts/lane.ts', 'red'],
    ['rulesets/main.json', 'red'],
    ['LANES.md', 'red'],
    ['package.json', 'red'],
    ['package-lock.json', 'red'],
    ['src/security/token.ts', 'red'],
    ['src/auth/login.ts', 'red'],
    ['src/secrets/vault.ts', 'red'],
    ['src/permissions/roles.ts', 'red'],
    ['db/migrations/001_init.sql', 'red'],
    ['migrations/001_init.sql', 'red'],
    ['prompts/summary.md', 'red'],
    ['evals/cases.jsonl', 'red'],
  ])('%s is %s', (path, lane) => {
    expect(classifyFile(path, config)).toBe(lane);
  });

  it('is not fooled by letter case', () => {
    expect(classifyFile('.GitHub/Workflows/gate.yml', config)).toBe('red');
    expect(classifyFile('Prompts/x.md', config)).toBe('red');
  });

  it.each(['.gitignore', '.env', '.editorconfig', '.unknown-tool.json', '.some-new-dir/x.md', '.prettierrc'])(
    'puts the unknown root dotfile or dot-directory %s in red',
    (path) => {
      expect(classifyFile(path, config)).toBe('red');
    },
  );

  it('puts a root dot path in red even when a green pattern matches it', () => {
    const dotGreen: LaneConfig = { ruleVersion: 't', green: ['.docs/**'], red: [] };
    expect(classifyFile('.docs/a.md', dotGreen)).toBe('red');
  });

  it.each([
    ['src/.hidden.ts', 'amber'],
    ['docs/.hidden.md', 'amber'],
    ['docs/internal/.hidden.md', 'green'],
    ['docs/internal/.hidden/deep.md', 'green'],
    ['src/.config/security/x.ts', 'red'],
    ['a/.husky/pre-commit', 'amber'],
  ])('does not skip hidden paths below the root: %s is %s', (path, lane) => {
    expect(classifyFile(path, config)).toBe(lane);
  });

  it('puts a path that matches both green and red in red', () => {
    const both: LaneConfig = { ruleVersion: 't', green: ['docs/**'], red: ['docs/secret/**'] };
    expect(classifyFile('docs/secret/a.md', both)).toBe('red');
    expect(classifyFile('docs/open/a.md', both)).toBe('green');
  });

  it('puts a path it cannot read in red', () => {
    expect(classifyFile('../outside.md', config)).toBe('red');
    expect(classifyFile('docs/internal/../../.github/x.yml', config)).toBe('red');
  });
});

describe('the red list names each tool-configuration file on its own', () => {
  // These paths are also red through the unknown-dotfile rule. The explicit entries stay,
  // so a change to that rule cannot move them out of the red lane unnoticed.
  it.each(['.npmrc', '.yarnrc', '.yarnrc.yml', '.nvmrc', '.node-version', '.husky/pre-commit', 'stryker.config.json', 'stryker.ci.conf.mjs'])(
    '%s matches a red pattern',
    (path) => {
      expect(picomatch.isMatch(path, [...config.red], { dot: true, nocase: true })).toBe(true);
    },
  );
});

describe('a config with empty lists', () => {
  it('puts every readable path in amber', () => {
    expect(classifyFile('src/a.ts', { ruleVersion: 't', green: [], red: [] })).toBe('amber');
  });
});

describe('classifyChange', () => {
  it('is green when every file is green', () => {
    const result = classifyChange(['docs/internal/a.md', 'docs/internal/b/c.md'], config);
    expect(result.lane).toBe('green');
  });

  it('is amber when green and amber files are mixed', () => {
    expect(classifyChange(['docs/internal/a.md', 'src/invoice.ts'], config).lane).toBe('amber');
  });

  it('is red when one file is red, whatever the rest', () => {
    expect(
      classifyChange(['docs/internal/a.md', 'src/invoice.ts', '.github/workflows/gate.yml'], config)
        .lane,
    ).toBe('red');
    expect(classifyChange(['docs/internal/a.md', 'prompts/x.md'], config).lane).toBe('red');
  });

  it('does not depend on the order of the files', () => {
    const files = ['src/invoice.ts', 'docs/internal/a.md', 'evals/x.json'];
    expect(classifyChange(files, config).lane).toBe('red');
    expect(classifyChange([...files].reverse(), config).lane).toBe('red');
  });

  it('is amber when there are no files, so a person looks', () => {
    expect(classifyChange([], config).lane).toBe('amber');
  });

  it('reports the lane of each file and the rule version', () => {
    const result = classifyChange(['docs/internal/a.md', 'src/invoice.ts'], config);
    expect(result.files).toEqual([
      { path: 'docs/internal/a.md', lane: 'green' },
      { path: 'src/invoice.ts', lane: 'amber' },
    ]);
    expect(result.ruleVersion).toBe(config.ruleVersion);
  });
});

describe('main', () => {
  it('prints the lane for files given as arguments', () => {
    const io = fakeIo({ files: { 'gate/lanes.json': JSON.stringify(config) } });
    expect(main(['docs/internal/a.md'], io)).toBe(0);
    expect(io.stdout).toEqual(['green']);
  });

  it('reads the changed files from git with --base, with no rename detection', () => {
    const io = fakeIo({
      files: { 'gate/lanes.json': JSON.stringify(config) },
      git: (args) => {
        expect(args).toEqual(['diff', '-z', '--name-only', '--no-renames', 'origin/main...HEAD']);
        return 'docs/internal/a.md\0.github/workflows/gate.yml\0';
      },
    });
    expect(main(['--base', 'origin/main'], io)).toBe(0);
    expect(io.stdout).toEqual(['red']);
  });

  it('keeps reading options after the --base value', () => {
    const io = fakeIo({
      files: { 'gate/lanes.json': JSON.stringify(config) },
      git: () => 'docs/internal/a.md\0',
    });
    expect(main(['--base', 'origin/main', '--json'], io)).toBe(0);
    expect(JSON.parse(io.stdout.join('\n'))).toMatchObject({ lane: 'green' });
  });

  it('ignores the empty entry that ends the git output', () => {
    const io = fakeIo({
      files: { 'gate/lanes.json': JSON.stringify(config) },
      git: () => 'docs/internal/a.md\0docs/internal/b.md\0',
    });
    main(['--base', 'origin/main'], io);
    expect(io.stdout).toEqual(['green']);
  });

  it('exits 2 when both --base and file names are given', () => {
    const io = fakeIo({ files: { 'gate/lanes.json': JSON.stringify(config) } });
    expect(main(['--base', 'origin/main', 'a.md'], io)).toBe(2);
    expect(io.stderr.join('\n')).toContain('not both');
  });

  it('prints JSON with --json', () => {
    const io = fakeIo({ files: { 'gate/lanes.json': JSON.stringify(config) } });
    main(['--json', 'src/invoice.ts'], io);
    const parsed = JSON.parse(io.stdout.join('\n')) as { lane: string; ruleVersion: string };
    expect(parsed.lane).toBe('amber');
    expect(parsed.ruleVersion).toBe(config.ruleVersion);
  });

  it('exits 2 and says why when --base has no value', () => {
    const io = fakeIo({ files: { 'gate/lanes.json': JSON.stringify(config) } });
    expect(main(['--base'], io)).toBe(2);
    expect(io.stderr.join('\n')).toContain('--base needs a value');
  });

  it('exits 2 when git fails', () => {
    const io = fakeIo({
      files: { 'gate/lanes.json': JSON.stringify(config) },
      git: () => {
        throw new Error('bad ref');
      },
    });
    expect(main(['--base', 'nope'], io)).toBe(2);
    expect(io.stderr.join('\n')).toContain('bad ref');
  });
});

describe('the lane config and the files that carry it', () => {
  it('LANES.md names every pattern in lanes.json', () => {
    const page = readFileSync(join(root, 'LANES.md'), 'utf8');
    for (const pattern of [...config.green, ...config.red]) {
      expect(page, `LANES.md does not list ${pattern}`).toContain(`\`${pattern}\``);
    }
    expect(page).toContain(config.ruleVersion);
  });

  it('CODEOWNERS covers a sample path of every red pattern with the owner', () => {
    const lines = readFileSync(join(root, '.github', 'CODEOWNERS'), 'utf8')
      .split('\n')
      .filter((line) => line.trim() !== '' && !line.startsWith('#'));
    for (const line of lines) {
      expect(line.split(/\s+/).slice(1)).toEqual(['@juliensimon', '@juliensolfird']);
    }
    const owned = ignore().add(lines.map((line) => line.split(/\s+/)[0]!));
    const samples = [
      '.github/workflows/gate.yml',
      'CODEOWNERS',
      'eslint.config.js',
      'eslint.complexity.config.js',
      'vitest.config.ts',
      'stryker.config.json',
      'stryker.ci.conf.mjs',
      '.npmrc',
      '.yarnrc.yml',
      '.nvmrc',
      '.node-version',
      '.husky/pre-commit',
      '.gitignore',
      '.some-new-dir/x.md',
      'tsconfig.json',
      '.dependency-cruiser.cjs',
      'osv-scanner.toml',
      '.gitleaks.toml',
      '.semgrep/rules.yml',
      '.semgrepignore',
      'gate/baseline.json',
      'scripts/lane.ts',
      'rulesets/main.json',
      'LANES.md',
      'package.json',
      'package-lock.json',
      'src/security/token.ts',
      'src/auth/login.ts',
      'src/secrets/vault.ts',
      'src/permissions/roles.ts',
      'db/migrations/001_init.sql',
      'prompts/summary.md',
      'evals/cases.jsonl',
    ];
    for (const sample of samples) {
      expect(classifyFile(sample, config), `${sample} is not red`).toBe('red');
      expect(owned.ignores(sample), `${sample} has no code owner`).toBe(true);
    }
  });

  it('no green path has a code owner', () => {
    const lines = readFileSync(join(root, '.github', 'CODEOWNERS'), 'utf8')
      .split('\n')
      .filter((line) => line.trim() !== '' && !line.startsWith('#'));
    const owned = ignore().add(lines.map((line) => line.split(/\s+/)[0]!));
    expect(owned.ignores('docs/internal/runbook.md')).toBe(false);
  });
});
