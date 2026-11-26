import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(import.meta.dirname, '..', '..');
const specFiles = readdirSync(join(root, 'specs')).filter((f) => /^\d{3}-.*\.md$/.test(f));
const acceptanceFiles = readdirSync(join(root, 'tests', 'acceptance'));

describe('every spec has acceptance tests', () => {
  it('finds at least one spec', () => {
    expect(specFiles.length).toBeGreaterThan(0);
  });

  it.each(specFiles)('%s has an acceptance test file and a test for each requirement', (file) => {
    const number = file.slice(0, 3);
    const testFile = acceptanceFiles.find((f) => f.startsWith(`spec-${number}-`));
    expect(testFile, `no acceptance test file for spec ${number}`).toBeDefined();

    const spec = readFileSync(join(root, 'specs', file), 'utf8');
    const ids = [...spec.matchAll(/\*\*(\d{3}\.\d+)\*\*/g)].map((m) => m[1]!);
    expect(ids.length).toBeGreaterThan(0);

    const tests = readFileSync(join(root, 'tests', 'acceptance', testFile!), 'utf8');
    for (const id of ids) {
      expect(tests, `no acceptance test for requirement ${id}`).toContain(`'${id} `);
    }
  });
});
