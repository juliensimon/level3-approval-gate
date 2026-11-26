import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  isoWeek,
  main,
  renderRecord,
  selectAuditSample,
  type PullRequest,
} from '../../scripts/audit.ts';
import { fakeIo } from './fake-io.ts';

const root = join(import.meta.dirname, '..', '..');

const allPass = { types: 'pass', tests: 'pass', lint: 'pass' } as const;

function pr(number: number, patch: Partial<PullRequest> = {}): PullRequest {
  return {
    number,
    title: `Change ${number}`,
    lane: 'green',
    aiApproved: true,
    approver: 'ai-reviewer',
    checks: allPass,
    ruleVersion: '1.0.0',
    redProximity: 0.5,
    ...patch,
  };
}

describe('isoWeek', () => {
  it.each([
    ['2026-11-26', 2026, 48],
    ['2026-01-01', 2026, 1],
    ['2024-12-30', 2025, 1],
    ['2021-01-03', 2020, 53],
    ['2026-11-29', 2026, 48],
    ['2026-11-30', 2026, 49],
  ])('%s is week %i-%i', (date, year, week) => {
    expect(isoWeek(new Date(`${date}T12:00:00Z`))).toEqual({ year, week });
  });
});

describe('selectAuditSample', () => {
  const approved = [
    pr(1, { redProximity: 0.1 }),
    pr(2, { redProximity: 0.9 }),
    pr(3, { redProximity: 0.5 }),
    pr(4, { redProximity: 0.7 }),
    pr(5, { redProximity: 0.3 }),
    pr(6, { redProximity: 0.8 }),
    pr(7, { redProximity: 0.2 }),
    pr(8, { redProximity: 0.4 }),
  ];
  const held = [
    pr(11, { aiApproved: false, lane: 'amber', approver: 'person', redProximity: 0.6 }),
    pr(12, { aiApproved: false, lane: 'amber', approver: 'person', redProximity: 0.05 }),
    pr(13, { aiApproved: false, lane: 'red', approver: 'person', redProximity: 0.95 }),
    pr(14, { aiApproved: false, lane: 'amber', approver: 'person', redProximity: 0.15 }),
    pr(15, { aiApproved: false, lane: 'amber', approver: 'person', redProximity: 0.25 }),
  ];
  const all = [...approved, ...held];

  it('takes the three AI-approved changes closest to red, closest first', () => {
    expect(selectAuditSample(all, { seed: 1, sampleSize: 2 }).closestToRed.map((p) => p.number)).toEqual([2, 6, 4]);
  });

  it('takes the three held changes closest to green, closest first', () => {
    expect(selectAuditSample(all, { seed: 1, sampleSize: 2 }).closestToGreen.map((p) => p.number)).toEqual([12, 14, 15]);
  });

  it('draws the random sample from AI-approved changes not already picked', () => {
    for (let seed = 0; seed < 50; seed += 1) {
      const { random } = selectAuditSample(all, { seed, sampleSize: 3 });
      expect(random).toHaveLength(3);
      for (const p of random) {
        expect(p.aiApproved).toBe(true);
        expect([2, 6, 4]).not.toContain(p.number);
      }
      expect(new Set(random.map((p) => p.number)).size).toBe(3);
    }
  });

  it('gives the same sample for the same seed and can differ for another seed', () => {
    const a = selectAuditSample(all, { seed: 7, sampleSize: 3 }).random.map((p) => p.number);
    const b = selectAuditSample(all, { seed: 7, sampleSize: 3 }).random.map((p) => p.number);
    expect(a).toEqual(b);
    const others = Array.from({ length: 20 }, (_, seed) =>
      selectAuditSample(all, { seed, sampleSize: 3 }).random.map((p) => p.number).join(','),
    );
    expect(new Set(others).size).toBeGreaterThan(1);
  });

  it('breaks ties by pull request number', () => {
    const tied = [pr(5, { redProximity: 0.5 }), pr(3, { redProximity: 0.5 }), pr(4, { redProximity: 0.5 })];
    expect(selectAuditSample(tied, { seed: 1, sampleSize: 0 }).closestToRed.map((p) => p.number)).toEqual([3, 4, 5]);
  });

  it('breaks ties on the green side by pull request number too', () => {
    const tied = [
      pr(9, { aiApproved: false, redProximity: 0.2 }),
      pr(7, { aiApproved: false, redProximity: 0.2 }),
      pr(8, { aiApproved: false, redProximity: 0.2 }),
    ];
    expect(selectAuditSample(tied, { seed: 1, sampleSize: 0 }).closestToGreen.map((p) => p.number)).toEqual([7, 8, 9]);
  });

  it('returns what exists when there are fewer changes than slots', () => {
    const few = [pr(1), pr(2, { aiApproved: false, lane: 'amber' })];
    const result = selectAuditSample(few, { seed: 1, sampleSize: 3 });
    expect(result.closestToRed.map((p) => p.number)).toEqual([1]);
    expect(result.closestToGreen.map((p) => p.number)).toEqual([2]);
    expect(result.random).toEqual([]);
  });

  it('does not change the input list', () => {
    const copy = structuredClone(all);
    selectAuditSample(all, { seed: 1, sampleSize: 3 });
    expect(all).toEqual(copy);
  });
});

describe('renderRecord', () => {
  const selection = {
    closestToRed: [pr(2, { title: 'Docs | pipes', verdict: 'correct', checks: { ...allPass, lint: 'fail' } })],
    closestToGreen: [pr(12, { aiApproved: false, lane: 'amber', approver: 'person:alex', verdict: 'correct' })],
    random: [pr(5)],
  };
  const text = renderRecord({ year: 2026, week: 8 }, selection, { seed: 7, source: 'live' });

  it('has the week in the title and a table with the six columns in each section', () => {
    expect(text).toContain('# Audit 2026-08');
    const header = '| PR | Lane | Checks | Approver | Rule version | Person\'s verdict |';
    expect(text.split(header)).toHaveLength(4);
    expect(text).toContain('## AI-approved changes closest to the red lane');
    expect(text).toContain('## Held changes closest to the green lane');
    expect(text).toContain('## Random sample of AI-approved changes');
  });

  it('shows checks as a count and names the ones that did not pass', () => {
    expect(text).toContain('2/3 pass (lint: fail)');
    expect(text).toContain('3/3 pass');
  });

  it('escapes pipes in titles and shows PENDING when there is no verdict', () => {
    expect(text).toContain('#2 Docs \\| pipes');
    expect(text).toMatch(/#5 Change 5 \| green \| 3\/3 pass \| ai-reviewer \| 1\.0\.0 \| PENDING \|/);
  });

  it('says the audit is pending while a verdict is open', () => {
    expect(text).toContain('Result: pending, 1 verdict open.');
  });

  it('says the audit is clean when every verdict is correct', () => {
    const done = renderRecord(
      { year: 2026, week: 8 },
      { closestToRed: [pr(2, { verdict: 'correct' })], closestToGreen: [], random: [] },
      { seed: 1, source: 'live' },
    );
    expect(done).toContain('Result: clean. No wrong approval.');
  });

  it('pauses AI approval when a person finds a wrong approval', () => {
    const bad = renderRecord(
      { year: 2026, week: 8 },
      { closestToRed: [pr(2, { verdict: 'wrong' })], closestToGreen: [], random: [pr(5, { verdict: 'wrong' })] },
      { seed: 1, source: 'live' },
    );
    expect(bad).toContain('Result: not clean. 2 wrong approvals. AI approval pauses for the affected category until a new rule covers it.');
  });

  it('does not count a wrong verdict on a held change as a wrong approval', () => {
    const held = renderRecord(
      { year: 2026, week: 8 },
      { closestToRed: [], closestToGreen: [pr(12, { aiApproved: false, verdict: 'wrong' })], random: [] },
      { seed: 1, source: 'live' },
    );
    expect(held).toContain('Result: clean. No wrong approval.');
    expect(held).toContain('1 held change was judged wrong');
  });

  it('uses the plural for several held changes judged wrong', () => {
    const held = renderRecord(
      { year: 2026, week: 8 },
      {
        closestToRed: [],
        closestToGreen: [
          pr(12, { aiApproved: false, verdict: 'wrong' }),
          pr(13, { aiApproved: false, verdict: 'wrong' }),
        ],
        random: [],
      },
      { seed: 1, source: 'live' },
    );
    expect(held).toContain('2 held changes were judged wrong');
  });

  it('uses the singular for one wrong approval', () => {
    const one = renderRecord(
      { year: 2026, week: 8 },
      { closestToRed: [pr(2, { verdict: 'wrong' })], closestToGreen: [], random: [] },
      { seed: 1, source: 'live' },
    );
    expect(one).toContain('1 wrong approval.');
  });

  it('records the seed and the rule versions', () => {
    expect(text).toContain('Seed: 7');
    expect(text).toContain('Rule version: 1.0.0');
  });

  it('lists several rule versions when the week had more than one', () => {
    const mixed = renderRecord(
      { year: 2026, week: 8 },
      { closestToRed: [pr(2, { ruleVersion: '1.1.0' })], closestToGreen: [], random: [pr(5)] },
      { seed: 1, source: 'live' },
    );
    expect(mixed).toContain('Rule versions: 1.0.0, 1.1.0');
  });

  it('labels a record built from fixtures as an example', () => {
    const fixture = renderRecord({ year: 2026, week: 8 }, selection, { seed: 7, source: 'fixture' });
    expect(fixture).toContain('Example record built from fixture data. These are not real pull requests.');
    expect(text).not.toContain('Example record');
  });

  it('shows an empty section as none', () => {
    const empty = renderRecord(
      { year: 2026, week: 8 },
      { closestToRed: [], closestToGreen: [], random: [] },
      { seed: 1, source: 'live' },
    );
    expect(empty.match(/None this week\./g)).toHaveLength(3);
    expect(empty).toContain('Result: clean. No wrong approval.');
  });
});

describe('main', () => {
  const input = {
    weekOf: '2026-11-23',
    source: 'fixture',
    pullRequests: [pr(1, { redProximity: 0.9 }), pr(2, { aiApproved: false, lane: 'amber', approver: 'person' })],
  };

  it('reads the list, writes audit/records/YYYY-WW.md and says where', () => {
    const files: Record<string, string> = { 'in.json': JSON.stringify(input) };
    const io = fakeIo({ files });
    expect(main(['--input', 'in.json', '--seed', '3'], io)).toBe(0);
    expect(Object.keys(files)).toContain('audit/records/2026-48.md');
    expect(files['audit/records/2026-48.md']).toContain('# Audit 2026-48');
    expect(files['audit/records/2026-48.md']).toContain('Seed: 3');
    expect(io.stdout.join('\n')).toContain('audit/records/2026-48.md');
  });

  it('takes the week from --date and the folder from --out, and the sample size from --sample', () => {
    const files: Record<string, string> = { 'in.json': JSON.stringify({ ...input, weekOf: undefined }) };
    const io = fakeIo({ files });
    expect(main(['--input', 'in.json', '--date', '2026-01-05', '--out', 'x', '--sample', '1'], io)).toBe(0);
    expect(Object.keys(files)).toContain('x/2026-02.md');
  });

  it('falls back to the clock when the file and the flags give no date', () => {
    const files: Record<string, string> = { 'in.json': JSON.stringify({ ...input, weekOf: undefined }) };
    const io = fakeIo({ files });
    expect(main(['--input', 'in.json'], io)).toBe(0);
    expect(Object.keys(files)).toContain('audit/records/2026-48.md');
  });

  it.each([
    [['--input'], '--input needs a value'],
    [[], '--input is required'],
    [['--input', 'in.json', '--seed', 'x'], '--seed must be a whole number'],
    [['--input', 'in.json', '--sample', '-1'], '--sample must be a whole number'],
    [['--input', 'in.json', '--date', 'yesterday'], '--date must be YYYY-MM-DD'],
    [['--input', 'missing.json'], 'no such file'],
  ])('exits 2 for %j', (argv, message) => {
    const io = fakeIo({ files: { 'in.json': JSON.stringify(input) } });
    expect(main(argv, io)).toBe(2);
    expect(io.stderr.join('\n')).toContain(message);
  });

  it.each([
    [{ pullRequests: 'x' }, 'pullRequests must be a list'],
    [{ pullRequests: [{ ...pr(1), redProximity: 1.5 }] }, 'redProximity'],
    [{ pullRequests: [{ ...pr(1), aiApproved: 'yes' }] }, 'aiApproved'],
    [{ pullRequests: [{ ...pr(1), lane: 'blue' }] }, 'lane'],
    [{ pullRequests: [{ ...pr(1), number: 'one' }] }, 'number'],
  ])('exits 2 for the bad input %j', (bad, message) => {
    const io = fakeIo({ files: { 'in.json': JSON.stringify(bad) } });
    expect(main(['--input', 'in.json'], io)).toBe(2);
    expect(io.stderr.join('\n')).toContain(message);
  });
});

describe('the example record', () => {
  it('is the output of main() on the fixture, so it can be reproduced', () => {
    const fixture = readFileSync(join(root, 'audit', 'fixtures', 'prs-2026-w48.json'), 'utf8');
    const files: Record<string, string> = { 'audit/fixtures/prs-2026-w48.json': fixture };
    const io = fakeIo({ files });
    expect(main(['--input', 'audit/fixtures/prs-2026-w48.json', '--seed', '7'], io)).toBe(0);
    const committed = readFileSync(join(root, 'audit', 'records', '2026-48.md'), 'utf8');
    expect(files['audit/records/2026-48.md']).toBe(committed);
    expect(committed).toContain('Result: clean. No wrong approval.');
  });
});
