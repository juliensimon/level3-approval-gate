import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const root = join(import.meta.dirname, '..', '..');
const read = (path: string): string => readFileSync(join(root, path), 'utf8');

interface Step {
  uses?: string;
  run?: string;
}
interface Workflow {
  on: Record<string, unknown>;
  permissions: Record<string, string>;
  jobs: Record<string, { name: string; steps: Step[] }>;
}
interface Ruleset {
  name: string;
  target: string;
  enforcement: string;
  bypass_actors: unknown[];
  rules: { type: string; parameters?: Record<string, unknown> }[];
}

const workflowText = read('.github/workflows/gate.yml');
const workflow = parse(workflowText) as Workflow;
const ruleset = JSON.parse(read('rulesets/main.json')) as Ruleset;
const scripts = (JSON.parse(read('package.json')) as { scripts: Record<string, string> }).scripts;

const EXPECTED_CHECKS = [
  'types',
  'tests',
  'lint',
  'complexity',
  'architecture',
  'security',
  'suppressions',
  'ratchet',
  'lane',
];

describe('gate workflow', () => {
  const jobs = Object.values(workflow.jobs);

  it('has one job for each check, named as the ruleset expects', () => {
    expect(jobs.map((job) => job.name).sort()).toEqual([...EXPECTED_CHECKS].sort());
  });

  it('runs on pull requests, never on pull_request_target', () => {
    expect(Object.keys(workflow.on)).toEqual(['pull_request']);
  });

  it('gives the token read access to contents only', () => {
    expect(workflow.permissions).toEqual({ contents: 'read' });
  });

  it('uses no secret', () => {
    expect(workflowText).not.toContain('secrets.');
  });

  it('puts no expression inside a run step, so no pull request text reaches a shell', () => {
    const steps = jobs.flatMap((job) => job.steps);
    for (const step of steps) {
      expect(step.run ?? '').not.toContain('${{');
    }
  });

  it('runs only npm scripts that exist', () => {
    const called = [...workflowText.matchAll(/npm run (gate:[\w-]+)/g)].map((m) => m[1]!);
    expect(called.length).toBeGreaterThan(0);
    for (const name of called) {
      expect(scripts[name], `package.json has no script ${name}`).toBeDefined();
    }
  });

  it('every gate script that CI needs is called by some job', () => {
    for (const name of ['gate:types', 'gate:tests', 'gate:diff-coverage', 'gate:lint', 'gate:complexity', 'gate:architecture', 'gate:semgrep', 'gate:gitleaks', 'gate:osv', 'gate:suppressions', 'gate:ratchet', 'gate:lane']) {
      expect(workflowText, `${name} is not run in CI`).toContain(`npm run ${name}`);
    }
  });

  it('pins every action to a version tag or a full commit SHA', () => {
    const uses = [...workflowText.matchAll(/uses:\s*(\S+)/g), ...read('.github/actions/setup/action.yml').matchAll(/uses:\s*(\S+)/g)].map((m) => m[1]!);
    for (const ref of uses.filter((u) => !u.startsWith('./'))) {
      expect(ref, ref).toMatch(/@(?:v\d+(?:\.\d+)*|[0-9a-f]{40})$/);
    }
  });
});

describe('ruleset', () => {
  const rule = (type: string): { type: string; parameters?: Record<string, unknown> } | undefined =>
    ruleset.rules.find((r) => r.type === type);

  it('targets the default branch and is active', () => {
    expect(ruleset.target).toBe('branch');
    expect(ruleset.enforcement).toBe('active');
    expect(JSON.stringify(ruleset)).toContain('~DEFAULT_BRANCH');
  });

  it('lists no bypass actor', () => {
    expect(ruleset.bypass_actors).toEqual([]);
  });

  it('blocks force pushes and branch deletion', () => {
    expect(rule('non_fast_forward')).toBeDefined();
    expect(rule('deletion')).toBeDefined();
  });

  it('requires a pull request with a review, a code owner review, and a fresh approval after each push', () => {
    const parameters = rule('pull_request')?.parameters;
    expect(parameters?.['required_approving_review_count']).toBeGreaterThanOrEqual(1);
    expect(parameters?.['require_code_owner_review']).toBe(true);
    expect(parameters?.['dismiss_stale_reviews_on_push']).toBe(true);
    expect(parameters?.['require_last_push_approval']).toBe(true);
  });

  it('requires exactly the checks the workflow defines, by job name', () => {
    const checks = rule('required_status_checks')?.parameters?.['required_status_checks'] as { context: string }[];
    expect(checks.map((c) => c.context).sort()).toEqual([...EXPECTED_CHECKS].sort());
    expect(rule('required_status_checks')?.parameters?.['strict_required_status_checks_policy']).toBe(true);
  });

  it('pins every required check to the app that may report it, so no other app can spoof it', () => {
    const checks = rule('required_status_checks')?.parameters?.['required_status_checks'] as {
      context: string;
      integration_id?: unknown;
    }[];
    for (const check of checks) {
      expect(Number.isInteger(check.integration_id), `${check.context} has no integration_id`).toBe(true);
      expect(check.integration_id as number, `${check.context} has a bad integration_id`).toBeGreaterThan(0);
    }
    expect(new Set(checks.map((c) => c.integration_id)).size).toBe(1);
  });
});

describe('docker images are pinned by digest', () => {
  const VALUE_FLAGS = new Set(['-v', '--volume', '-w', '--workdir', '-e', '--env', '--entrypoint', '--name', '-u', '--user']);

  /** The image of each `docker run` in a command line: the first argument that is not a flag or a flag value. */
  function imagesIn(command: string): string[] {
    return [...command.matchAll(/docker run([^&|;\n]*)/g)].map((match) => {
      const tokens = (match[1] ?? '').trim().split(/\s+/);
      let i = 0;
      while (i < tokens.length && tokens[i]!.startsWith('-')) {
        i += VALUE_FLAGS.has(tokens[i]!) ? 2 : 1;
      }
      return tokens[i] ?? '';
    });
  }

  const workflowCommands = Object.values(workflow.jobs).flatMap((job) => job.steps.flatMap((s) => s.run ?? []));
  const commands = [...Object.entries(scripts).map(([name, c]) => [`package.json ${name}`, c]), ...workflowCommands.map((c) => ['gate.yml', c])] as [string, string][];
  const dockerCommands = commands.filter(([, command]) => command.includes('docker run'));

  it('finds the docker commands', () => {
    expect(dockerCommands.length).toBeGreaterThanOrEqual(3);
  });

  it.each(dockerCommands)('%s runs an image with a sha256 digest', (_where, command) => {
    for (const image of imagesIn(command)) {
      expect(image, `unpinned image in: ${command}`).toMatch(/^[\w./-]+@sha256:[0-9a-f]{64}$/);
    }
  });

  it('has no placeholder digest anywhere', () => {
    for (const [where, command] of commands) {
      expect(command, where).not.toContain('REPLACE_WITH_DIGEST');
    }
  });

  it('has no docker:// action and no image: key without a digest in the workflow', () => {
    for (const line of workflowText.split('\n')) {
      if (/docker:\/\/|^\s*image:/.test(line)) {
        expect(line).toMatch(/@sha256:[0-9a-f]{64}/);
      }
    }
  });
});

describe('the repository carries no private reference', () => {
  // Built from parts so this file does not contain the words it forbids.
  const forbidden = [['for', 'tino'], ['port', 'co'], ['inves', 'tor']].map((parts) => parts.join(''));

  function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      if (['node_modules', '.git', 'coverage', '.stryker-tmp', 'reports'].includes(name)) return [];
      return statSync(path).isDirectory() ? walk(path) : [path];
    });
  }

  it.each(walk(root).filter((p) => p !== join(root, 'package-lock.json')).map((p) => relative(root, p)))(
    '%s',
    (file) => {
      const text = read(file).toLowerCase();
      for (const word of forbidden) {
        expect(text, `${file} contains a forbidden word`).not.toContain(word);
      }
    },
  );
});

describe('prose register', () => {
  const markdown = (function find(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      if (['node_modules', '.git', 'coverage', '.stryker-tmp', 'reports'].includes(name)) return [];
      if (statSync(path).isDirectory()) return find(path);
      return name.endsWith('.md') ? [relative(root, path)] : [];
    });
  })(root);

  it.each(markdown)('%s has no em dash and no ellipsis outside code', (file) => {
    const prose = read(file).replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
    expect(prose).not.toContain('\u2014');
    expect(prose).not.toContain('\u2026');
    expect(prose).not.toContain('...');
  });
});
