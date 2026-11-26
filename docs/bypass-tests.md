# Bypass tests

Six attempts to get a change past the gate. Run them on a throwaway repository, then write each result in the README table. A result is what you observed. Do not fill a cell from this page. The results on this repository are in the README bypass table.

For each test, "Pass means" says what the gate is built to do. If you observe something else, the result is a failure and the setup needs a fix before any real change depends on it.

## 1. Admin bypass

- **Do:** As a repository administrator, try to merge a pull request that has a failing required check. Then try to push a commit straight to `main`.
- **Pass means:** Both are refused. `rulesets/main.json` lists no bypass actors, so no role can merge around the gate.
- **Check first:** In Settings > Rules, confirm no role or app is listed under bypass.

## 2. Mixed-path change

- **Do:** Open a pull request that changes `docs/internal/runbook.md` and `src/pricing/discount.ts`.
- **Pass means:** `npm run gate:lane` prints `amber`. Copilot's approval does not count and a person must approve.

## 3. New commit after approval

- **Do:** Open a green pull request and let Copilot approve it. Push one more commit to the branch.
- **Pass means:** The approval no longer counts. The merge stays blocked until the new commit has an approval.

## 4. Code owner required plus Copilot approval

- **Do:** Open a pull request that changes `prompts/invoice-summary.md` and get a Copilot approval on it.
- **Pass means:** The merge stays blocked until a member of the gate owners team approves, because the path has a code owner.
- **Result on this repository:** held. Copilot approved [#12](../../pull/12) and the merge stayed blocked until a code owner approved.

## 5. Agent edits its own gate config

- **Do:** As the agent identity, open a pull request that raises `maxCyclomatic` in `gate/baseline.json`, or lowers `lines` under `coverage`.
- **Pass means:** The `ratchet` check fails, the lane is red, and a gate owner is required to approve.

## 6. Agent deletes a test

- **Do:** As the agent identity, open a pull request that adds a skip to a test, then another that deletes a test file.
- **Pass means:** The `suppressions` check fails on both.
