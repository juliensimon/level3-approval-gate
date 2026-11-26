import { errorMessage, type Io } from './io.ts';
import type { Lane } from './lane.ts';

export type CheckResult = 'pass' | 'fail' | 'skipped';
export type Verdict = 'correct' | 'wrong';

export interface PullRequest {
  number: number;
  title: string;
  lane: Lane;
  aiApproved: boolean;
  approver: string;
  checks: Record<string, CheckResult>;
  ruleVersion: string;
  /** 0 is clearly green and 1 is clearly red. The auditing model assigns it. This script only ranks it. */
  redProximity: number;
  /** The person's judgment. Absent until a person has looked. */
  verdict?: Verdict;
}

export interface AuditSample {
  closestToRed: PullRequest[];
  closestToGreen: PullRequest[];
  random: PullRequest[];
}

export interface SampleOptions {
  seed: number;
  sampleSize: number;
}

const SIDE_SIZE = 3;

/** ISO 8601 week: the week belongs to the year that holds its Thursday. */
export function isoWeek(date: Date): { year: number; week: number } {
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  day.setUTCDate(day.getUTCDate() + 4 - (day.getUTCDay() || 7));
  const yearStart = Date.UTC(day.getUTCFullYear(), 0, 1);
  return { year: day.getUTCFullYear(), week: Math.ceil(((day.getTime() - yearStart) / 86_400_000 + 1) / 7) };
}

/** A small seeded generator, so a sample can be reproduced from its seed. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(items: readonly T[], seed: number): T[] {
  const copy = [...items];
  const next = mulberry32(seed);
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1));
    [copy[i], copy[j]] = [copy[j] as T, copy[i] as T];
  }
  return copy;
}

const byNumber = (a: PullRequest, b: PullRequest): number => a.number - b.number;

/**
 * Picks the three AI-approved changes closest to the red lane, the three held changes
 * closest to the green lane, and a random sample of the other AI-approved changes.
 */
export function selectAuditSample(prs: readonly PullRequest[], options: SampleOptions): AuditSample {
  const approved = prs.filter((p) => p.aiApproved);
  const held = prs.filter((p) => !p.aiApproved);
  const closestToRed = [...approved]
    .sort((a, b) => b.redProximity - a.redProximity || byNumber(a, b))
    .slice(0, SIDE_SIZE);
  const closestToGreen = [...held]
    .sort((a, b) => a.redProximity - b.redProximity || byNumber(a, b))
    .slice(0, SIDE_SIZE);
  const pool = approved.filter((p) => !closestToRed.includes(p)).sort(byNumber);
  return { closestToRed, closestToGreen, random: shuffled(pool, options.seed).slice(0, options.sampleSize) };
}

function checksCell(checks: Record<string, CheckResult>): string {
  const entries = Object.entries(checks);
  const passed = entries.filter(([, result]) => result === 'pass').length;
  const others = entries.filter(([, result]) => result !== 'pass').map(([name, result]) => `${name}: ${result}`);
  const summary = `${passed}/${entries.length} pass`;
  return others.length === 0 ? summary : `${summary} (${others.join(', ')})`;
}

function row(p: PullRequest): string {
  const title = p.title.replaceAll('|', '\\|');
  const cells = [`#${p.number} ${title}`, p.lane, checksCell(p.checks), p.approver, p.ruleVersion, p.verdict ?? 'PENDING'];
  return `| ${cells.join(' | ')} |`;
}

function section(title: string, prs: readonly PullRequest[]): string[] {
  const header = ['| PR | Lane | Checks | Approver | Rule version | Person\'s verdict |', '|---|---|---|---|---|---|'];
  return [`## ${title}`, '', ...(prs.length === 0 ? ['None this week.'] : [...header, ...prs.map(row)]), ''];
}

function resultLines(all: readonly PullRequest[]): string[] {
  const wrongApprovals = all.filter((p) => p.aiApproved && p.verdict === 'wrong').length;
  const open = all.filter((p) => p.verdict === undefined).length;
  const heldWrong = all.filter((p) => !p.aiApproved && p.verdict === 'wrong').length;
  const lines: string[] = [];
  if (wrongApprovals > 0) {
    const noun = wrongApprovals === 1 ? 'wrong approval' : 'wrong approvals';
    lines.push(`Result: not clean. ${wrongApprovals} ${noun}. AI approval pauses for the affected category until a new rule covers it.`);
  } else if (open > 0) {
    lines.push(`Result: pending, ${open} ${open === 1 ? 'verdict' : 'verdicts'} open.`);
  } else {
    lines.push('Result: clean. No wrong approval.');
  }
  if (heldWrong > 0) {
    const noun = heldWrong === 1 ? '1 held change was' : `${heldWrong} held changes were`;
    lines.push('', `${noun} judged wrong and may belong in a lighter lane.`);
  }
  return lines;
}

export function renderRecord(
  week: { year: number; week: number },
  sample: AuditSample,
  meta: { seed: number; source: 'fixture' | 'live' },
): string {
  const all = [...sample.closestToRed, ...sample.closestToGreen, ...sample.random];
  const versions = [...new Set(all.map((p) => p.ruleVersion))].sort();
  const label = `${week.year}-${String(week.week).padStart(2, '0')}`;
  return [
    `# Audit ${label}`,
    '',
    ...(meta.source === 'fixture' ? ['Example record built from fixture data. These are not real pull requests.', ''] : []),
    `- Week: ISO week ${label}`,
    `- ${versions.length === 1 ? 'Rule version' : 'Rule versions'}: ${versions.join(', ')}`,
    `- Seed: ${meta.seed}`,
    '',
    ...section('AI-approved changes closest to the red lane', sample.closestToRed),
    ...section('Held changes closest to the green lane', sample.closestToGreen),
    ...section('Random sample of AI-approved changes', sample.random),
    ...resultLines(all),
    '',
  ].join('\n');
}

interface Input {
  weekOf?: string;
  source: 'fixture' | 'live';
  pullRequests: PullRequest[];
}

function validatePullRequest(value: unknown, index: number): PullRequest {
  const p = value as Record<string, unknown>;
  const where = `pullRequests[${index}]`;
  if (!Number.isInteger(p['number'])) throw new Error(`${where}.number must be a whole number.`);
  if (!['green', 'amber', 'red'].includes(p['lane'] as string)) throw new Error(`${where}.lane must be green, amber or red.`);
  if (typeof p['aiApproved'] !== 'boolean') throw new Error(`${where}.aiApproved must be true or false.`);
  const proximity = p['redProximity'];
  if (typeof proximity !== 'number' || proximity < 0 || proximity > 1) {
    throw new Error(`${where}.redProximity must be a number from 0 to 1.`);
  }
  return p as unknown as PullRequest;
}

function parseInput(text: string): Input {
  const raw = JSON.parse(text) as Record<string, unknown>;
  if (!Array.isArray(raw['pullRequests'])) throw new Error('pullRequests must be a list.');
  const input: Input = {
    source: raw['source'] === 'fixture' ? 'fixture' : 'live',
    pullRequests: raw['pullRequests'].map(validatePullRequest),
  };
  if (typeof raw['weekOf'] === 'string') input.weekOf = raw['weekOf'];
  return input;
}

function flagValue(argv: readonly string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  if (i === -1) return undefined;
  const value = argv[i + 1];
  if (value === undefined) throw new Error(`${name} needs a value.`);
  return value;
}

function wholeNumber(name: string, value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  if (!/^\d+$/.test(value)) throw new Error(`${name} must be a whole number.`);
  return Number(value);
}

function weekDate(value: string | undefined, io: Io): Date {
  if (value === undefined) return io.now();
  const date = new Date(`${value}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(date.getTime())) {
    throw new Error('--date must be YYYY-MM-DD.');
  }
  return date;
}

export function main(argv: readonly string[], io: Io): number {
  try {
    const inputPath = flagValue(argv, '--input');
    if (inputPath === undefined) throw new Error('--input is required: a JSON file with the week\'s pull requests.');
    const seed = wholeNumber('--seed', flagValue(argv, '--seed'), 1);
    const sampleSize = wholeNumber('--sample', flagValue(argv, '--sample'), 3);
    const outDir = flagValue(argv, '--out') ?? 'audit/records';
    const input = parseInput(io.readFile(inputPath));
    const week = isoWeek(weekDate(flagValue(argv, '--date') ?? input.weekOf, io));
    const record = renderRecord(week, selectAuditSample(input.pullRequests, { seed, sampleSize }), {
      seed,
      source: input.source,
    });
    const path = `${outDir}/${week.year}-${String(week.week).padStart(2, '0')}.md`;
    io.writeFile(path, record);
    io.out(`Wrote ${path}`);
    return 0;
  } catch (error) {
    io.err(errorMessage(error));
    return 2;
  }
}
