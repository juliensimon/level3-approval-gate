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
