import { errorMessage, type Io } from './io.ts';

export function buildCommand(base: string, failUnder: number): { command: string; args: string[] } {
  return {
    command: 'diff-cover',
    args: ['coverage/lcov.info', `--compare-branch=${base}`, `--fail-under=${failUnder}`],
  };
}

/** Runs diff-cover on the lcov report, so the lines a pull request changes must meet the limit in gate/baseline.json. */
export function main(argv: readonly string[], io: Io): number {
  const flag = argv.indexOf('--base');
  if (flag !== -1 && argv[flag + 1] === undefined) {
    io.err('--base needs a value.');
    return 2;
  }
  const base = (flag === -1 ? undefined : argv[flag + 1]) ?? io.env('DIFF_BASE') ?? 'origin/main';
  try {
    const baseline = JSON.parse(io.readFile('gate/baseline.json')) as { limits: { diffCoverage?: number } };
    const limit = baseline.limits.diffCoverage;
    if (typeof limit !== 'number') {
      io.err('gate/baseline.json has no limits.diffCoverage.');
      return 2;
    }
    const { command, args } = buildCommand(base, limit);
    return io.run(command, args);
  } catch (error) {
    const message = errorMessage(error);
    io.err(message);
    if ((error as { code?: string }).code === 'ENOENT') {
      io.err('diff-cover is not installed. Run: pip install diff-cover');
    }
    return 2;
  }
}
