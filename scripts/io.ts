/** Everything the gate scripts need from the outside world, so main() can be tested without a shell. */
export interface Io {
  out(line: string): void;
  err(line: string): void;
  /** Path is relative to the repository root. */
  readFile(path: string): string;
  /** Path is relative to the repository root. Creates missing folders. */
  writeFile(path: string, content: string): void;
  /** Runs git in the repository and returns stdout. Throws on a non-zero exit. */
  git(args: string[]): string;
  readStdin(): string;
  /** Runs a command with inherited output and returns its exit code. */
  run(command: string, args: string[]): number;
  env(name: string): string | undefined;
  now(): Date;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
