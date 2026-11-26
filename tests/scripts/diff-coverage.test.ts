import { describe, expect, it } from 'vitest';
import { buildCommand, main } from '../../scripts/diff-coverage.ts';
import { fakeIo } from './fake-io.ts';

describe('buildCommand', () => {
  it('builds the diff-cover call from the base ref and the limit', () => {
    expect(buildCommand('origin/main', 95)).toEqual({
      command: 'diff-cover',
      args: ['coverage/lcov.info', '--compare-branch=origin/main', '--fail-under=95'],
    });
  });
});

const baseline = JSON.stringify({ limits: { diffCoverage: 100 } });

describe('main', () => {
  it('runs diff-cover with the limit from gate/baseline.json and the base from DIFF_BASE', () => {
    const seen: string[][] = [];
    const io = fakeIo({
      files: { 'gate/baseline.json': baseline },
      env: { DIFF_BASE: 'origin/develop' },
      run: (command, args) => {
        seen.push([command, ...args]);
        return 0;
      },
    });
    expect(main([], io)).toBe(0);
    expect(seen).toEqual([
      ['diff-cover', 'coverage/lcov.info', '--compare-branch=origin/develop', '--fail-under=100'],
    ]);
  });

  it('defaults the base to origin/main, and --base wins over DIFF_BASE', () => {
    const seen: string[] = [];
    const run = (_c: string, args: string[]): number => {
      seen.push(args[1]!);
      return 0;
    };
    main([], fakeIo({ files: { 'gate/baseline.json': baseline }, run }));
    main(['--base', 'origin/x'], fakeIo({ files: { 'gate/baseline.json': baseline }, env: { DIFF_BASE: 'y' }, run }));
    expect(seen).toEqual(['--compare-branch=origin/main', '--compare-branch=origin/x']);
  });

  it('passes the exit code of diff-cover through', () => {
    const io = fakeIo({ files: { 'gate/baseline.json': baseline }, run: () => 1 });
    expect(main([], io)).toBe(1);
  });

  it('exits 2 and says how to install diff-cover when it is missing', () => {
    const io = fakeIo({
      files: { 'gate/baseline.json': baseline },
      run: () => {
        throw Object.assign(new Error('spawn diff-cover ENOENT'), { code: 'ENOENT' });
      },
    });
    expect(main([], io)).toBe(2);
    expect(io.stderr.join('\n')).toContain('pip install diff-cover');
  });

  it('exits 2 when --base has no value', () => {
    expect(main(['--base'], fakeIo({ files: { 'gate/baseline.json': baseline } }))).toBe(2);
  });

  it('exits 2 when the baseline has no diffCoverage limit', () => {
    const io = fakeIo({ files: { 'gate/baseline.json': '{"limits":{}}' } });
    expect(main([], io)).toBe(2);
    expect(io.stderr.join('\n')).toContain('diffCoverage');
  });
});
