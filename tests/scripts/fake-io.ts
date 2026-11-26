import type { Io } from '../../scripts/io.ts';

export interface FakeIo extends Io {
  stdout: string[];
  stderr: string[];
}

interface Options {
  files?: Record<string, string>;
  git?: (args: string[]) => string;
  stdin?: string;
  run?: (command: string, args: string[]) => number;
  env?: Record<string, string>;
  now?: Date;
}

/** An Io that records output and serves canned files, so main() can be tested without a shell. */
export function fakeIo(options: Options = {}): FakeIo {
  const files = options.files ?? {};
  const stdout: string[] = [];
  const stderr: string[] = [];
  return {
    stdout,
    stderr,
    out: (line) => stdout.push(line),
    err: (line) => stderr.push(line),
    readFile: (path) => {
      const content = files[path];
      if (content === undefined) {
        throw new Error(`no such file: ${path}`);
      }
      return content;
    },
    writeFile: (path, content) => {
      files[path] = content;
    },
    git: options.git ?? (() => ''),
    readStdin: () => options.stdin ?? '',
    run: options.run ?? (() => 0),
    env: (name) => options.env?.[name],
    now: () => options.now ?? new Date('2026-11-26T12:00:00Z'),
  };
}
