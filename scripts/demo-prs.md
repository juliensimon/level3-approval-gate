# Demo pull requests

Four scenarios to open on GitHub, after review, in this order. Create each branch from `main`. Nothing here has been run on GitHub. The "Expected" lines state what the gate is built to do. Write what you observe in the README results table and in the pull request.

Use an identity that is not a gate owner as the author.

## 1. Green change, approved by the AI

**Branch:** `demo/green-docs`

**File change:** edit `docs/internal/runbook.md`. Add this section at the end:

```markdown
## Reading a gate result

Each check reports one line in the pull request. Open the failing check, read the first error, and fix the cause. Do not add a suppression to make a check pass.
```

**Expected:**
- `npm run gate:lane` prints `green`.
- All nine required checks pass.
- Copilot approves, because every changed file is on the Copilot path list `docs/internal/**`.
- The pull request merges with no person's approval.

## 2. Red change, goes to a person

**Branch:** `demo/red-prompt`

**File change:** add `prompts/invoice-summary.md` with this content:

```markdown
You summarize an invoice for a customer. State the total, the tax and the due date. Never state a figure that is not in the invoice data.
```

**Expected:**
- `npm run gate:lane` prints `red`, because `prompts/**` is a red path.
- All nine checks can pass, and the pull request still waits for a member of the gate owners team, because `prompts/` has a code owner.
- Copilot is not configured for this path, so it does not approve.

## 3. Mixed-path change, goes to a person

**Branch:** `demo/mixed-paths`

**File changes:**
- `docs/internal/runbook.md`: add one sentence at the end of the "Who to ask" section: `Ask in the engineering channel if a check result is unclear.`
- `src/pricing/discount.ts`: add this comment line directly above `const TIERS`: `// Sample tiers for the demo. Change them only with a matching change to specs/002-volume-discounts.md.`

**Expected:**
- `npm run gate:lane` prints `amber`: one green file and one amber file take the strictest lane.
- Copilot does not approve, because one changed file is outside the green path list.
- A person approves, then the pull request merges.

## 4. The agent weakens a test, and the gate fails

**Branch:** `demo/agent-weakens-test`

**File change:** in `tests/acceptance/spec-003-tax.test.ts`, change this line:

```typescript
  it('003.2 gives a tax of 0 at a rate of 0', () => {
```

to:

```typescript
  it.skip('003.2 gives a tax of 0 at a rate of 0', () => {
```

**Expected:**
- The `suppressions` check fails and names `tests/acceptance/spec-003-tax.test.ts` with the rule `skipped-test`.
- The lane is `amber` (a test file is not in the green lane), so Copilot would not approve in any case.
- The merge is blocked while a required check fails.

**Variants to try on a second branch:**
- Delete `tests/acceptance/spec-003-tax.test.ts`. Expected: `suppressions` fails with `deleted-test-file`, and `tests` fails because `tests/meta/spec-coverage.test.ts` finds no acceptance test for spec 003.
- Remove one `expect` line from a test and leave the test in place. This variant is not caught by the `suppressions` check. The mutation testing run (`npm run test:mutation`) is the control for it, and weakened assertions in the green lane do not occur because tests are not in the green lane.
