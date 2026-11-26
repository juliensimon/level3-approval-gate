import { describe, expect, it } from 'vitest';
import { checkRatchet, main, type Baseline } from '../../scripts/ratchet.ts';
import { fakeIo } from './fake-io.ts';

const base: Baseline = {
  limits: {
    coverage: { lines: 90, functions: 80, branches: 70, statements: 90 },
    diffCoverage: 90,
    complexity: { maxCyclomatic: 10, maxFileLines: 200, maxFunctionLines: 40 },
  },
};

const withLimits = (patch: Record<string, unknown>): Baseline => {
  const copy = structuredClone(base) as unknown as { limits: Record<string, unknown> };
  for (const [key, value] of Object.entries(patch)) {
    const [group, name] = key.split('.') as [string, string | undefined];
    if (name === undefined) {
      copy.limits[group] = value;
    } else {
      (copy.limits[group] as Record<string, unknown>)[name] = value;
    }
  }
  return copy as unknown as Baseline;
};

describe('checkRatchet', () => {
  it('passes when nothing changes', () => {
    expect(checkRatchet(base, base)).toEqual([]);
  });

  it('passes when every limit tightens', () => {
    const head = withLimits({
      'coverage.lines': 95,
      'coverage.branches': 71,
      diffCoverage: 100,
      'complexity.maxCyclomatic': 8,
      'complexity.maxFileLines': 150,
    });
    expect(checkRatchet(base, head)).toEqual([]);
  });

  it.each([
    ['coverage.lines', 89],
    ['coverage.functions', 79],
    ['coverage.branches', 69],
    ['coverage.statements', 89],
    ['diffCoverage', 89],
  ])('fails when %s is lowered to %i', (key, value) => {
    const problems = checkRatchet(base, withLimits({ [key]: value }));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain(key);
    expect(problems[0]).toContain('loosened');
  });

  it.each([
    ['complexity.maxCyclomatic', 11],
    ['complexity.maxFileLines', 201],
    ['complexity.maxFunctionLines', 41],
  ])('fails when %s is raised to %i', (key, value) => {
    const problems = checkRatchet(base, withLimits({ [key]: value }));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain(key);
  });

  it('fails when a limit is removed', () => {
    const head = structuredClone(base) as unknown as { limits: { coverage: Record<string, number> } };
    delete head.limits.coverage.branches;
    const problems = checkRatchet(base, head as unknown as Baseline);
    expect(problems).toEqual(['coverage.branches was removed.']);
  });

  it('fails when a group of limits is removed', () => {
    const head = structuredClone(base) as unknown as { limits: Record<string, unknown> };
    delete head.limits['complexity'];
    const problems = checkRatchet(base, head as unknown as Baseline);
    expect(problems).toHaveLength(3);
  });

  it.each(['90', null, Number.NaN, -1, 101])('fails when a limit is the invalid value %j', (value) => {
    const problems = checkRatchet(base, withLimits({ diffCoverage: value }));
    expect(problems).toEqual(['diffCoverage is not a valid number.']);
  });

  it('fails when a coverage limit is above 100', () => {
    expect(checkRatchet(base, withLimits({ 'coverage.lines': 101 }))).toEqual([
      'coverage.lines is not a valid number.',
    ]);
  });

  it('fails on a limit it does not know, so no limit escapes the ratchet', () => {
    const problems = checkRatchet(base, withLimits({ 'complexity.maxParams': 9 }));
    expect(problems).toEqual(['complexity.maxParams is unknown. Add its direction to scripts/ratchet.ts.']);
  });

  it('fails when the head file has no limits object', () => {
    expect(checkRatchet(base, {} as Baseline)).not.toEqual([]);
  });

  it('allows a new known limit that the base did not have', () => {
    const smaller = structuredClone(base) as unknown as { limits: Record<string, unknown> };
    delete smaller.limits['diffCoverage'];
    expect(checkRatchet(smaller as unknown as Baseline, base)).toEqual([]);
  });
});

describe('main', () => {
  const baseText = JSON.stringify(base);

  it('passes when the base ref has no baseline file yet', () => {
    const io = fakeIo({
      files: { 'gate/baseline.json': baseText },
      git: (args) => (args[0] === 'ls-tree' ? '' : 'sha'),
    });
    expect(main(['--base', 'origin/main'], io)).toBe(0);
    expect(io.stdout.join('\n')).toContain('no baseline');
  });

  it('compares the head file with the file at the base ref', () => {
    const calls: string[][] = [];
    const io = fakeIo({
      files: { 'gate/baseline.json': JSON.stringify(withLimits({ diffCoverage: 80 })) },
      git: (args) => {
        calls.push(args);
        if (args[0] === 'ls-tree') return 'gate/baseline.json\n';
        if (args[0] === 'show') return baseText;
        return 'sha';
      },
    });
    expect(main(['--base', 'origin/main'], io)).toBe(1);
    expect(io.stderr.join('\n')).toContain('diffCoverage');
    expect(calls).toContainEqual(['rev-parse', '--verify', 'origin/main']);
    expect(calls).toContainEqual(['show', 'origin/main:gate/baseline.json']);
  });

  it('passes when the head file tightens', () => {
    const io = fakeIo({
      files: { 'gate/baseline.json': JSON.stringify(withLimits({ diffCoverage: 95 })) },
      git: (args) => (args[0] === 'show' ? baseText : args[0] === 'ls-tree' ? 'x' : 'sha'),
    });
    expect(main(['--base', 'origin/main'], io)).toBe(0);
    expect(io.stdout.join('\n')).toContain('Ratchet holds');
  });

  it('exits 2, not 0, when the base ref does not exist', () => {
    const io = fakeIo({
      files: { 'gate/baseline.json': baseText },
      git: (args) => {
        if (args[0] === 'rev-parse') throw new Error('unknown revision');
        return '';
      },
    });
    expect(main(['--base', 'nope'], io)).toBe(2);
    expect(io.stderr.join('\n')).toContain('unknown revision');
  });

  it('exits 2 when --base is missing', () => {
    const io = fakeIo({ files: { 'gate/baseline.json': baseText } });
    expect(main([], io)).toBe(2);
    expect(io.stderr.join('\n')).toContain('--base');
  });

  it('exits 2 when the head file is not valid JSON', () => {
    const io = fakeIo({ files: { 'gate/baseline.json': '{' }, git: () => 'x' });
    expect(main(['--base', 'origin/main'], io)).toBe(2);
  });
});
