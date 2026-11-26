# level3-approval-gate

How an AI can approve part of the changes in a repository, safely.

This is a small, working sample for engineering leaders. A tiny TypeScript invoice library sits behind a real gate: a lane page that says which changes the AI may approve, a set of deterministic checks that every approval must pass, code owners for the rules themselves, and a weekly audit of the AI's decisions. Fork it, run it, and read how each piece works.

## See it work

Every way a change can go is an open or merged pull request in this repository. Open one and read the checks list, the Copilot review and the merge box.

| Pull request | Change | Lane | What happened |
|---|---|---|---|
| [#1](../../pull/1) | A line added to internal docs | Green | Copilot approved, GitHub showed it mergeable, and it merged with no person reading it. One more commit first dismissed the approval, and Copilot reviewed again. |
| [#2](../../pull/2) | A new AI prompt file | Red | Copilot only commented. The merge waited for a code owner. A second person approved and it merged. |
| [#3](../../pull/3) | One docs line and one source comment | Amber | Copilot wrote "approval recommended". GitHub did not count it, because one file is outside the green list. Blocked. |
| [#4](../../pull/4) | A test skipped | Amber | `suppressions` failed. Blocked. |
| [#5](../../pull/5) | A test file deleted | Amber | `suppressions` and `tests` failed. Blocked. |
| [#6](../../pull/6) | A complexity limit raised | Red | `ratchet` failed. Blocked. |
| [#7](../../pull/7) | New code with no test | Amber | `lint` and `tests` failed. Blocked. |
| [#8](../../pull/8) | A forbidden import between layers | Amber | `architecture` failed, with `lint`, `tests` and `types`. Blocked. |
| [#9](../../pull/9) | A fake API key committed | Amber | `security` failed: gitleaks found the key. Blocked. |

## The idea

When building is cheap, approval is the bottleneck. Your agents write code faster than your team reviews it. The question that sets your level is who approves.

Three rules make AI approval safe:

1. **Say what the AI may approve, as a list of paths.** The lane page, `LANES.md`, has three lanes. Green: the AI approves. Amber: a person approves. Red: always a person.
2. **Put the same checks behind every approval.** A gate of deterministic tools decides what may merge. No model judges the code.
3. **Audit the approvals every week.** A person checks the closest calls and a random sample. One wrong approval pauses AI approval for that category.

## The 4-step climb

Each step waits for clean weekly audits.

| Step | What the AI approves | Needs first |
|---|---|---|
| 1. Advisory | Nothing. It attaches an assessment to each pull request, and people approve everything. | Lane page, weekly audit, required CI checks |
| 2. Internal documentation | Changes to internal documentation only | Protected rules and a signed lane page |
| 3. Small UI and test-only changes | Add one category at a time | Acceptance tests with every spec |
| 4. A risk score inside amber | Low-risk changes in categories you open | A replay of past pull requests, then a shadow run |

This repository is set up for step 2. The green lane is `docs/internal/**` and nothing else.

## What is in the repository

| Path | What it is |
|---|---|
| `src/`, `tests/`, `specs/` | The sample service: invoice totals with volume discounts and tax. Five numbered specs, one acceptance test file per spec |
| `LANES.md`, `gate/lanes.json` | The lane page and the path patterns that `scripts/lane.ts` reads |
| `.github/CODEOWNERS` | The red lane and the gate's own files, owned by a person or a team of people (`@juliensimon` and `@juliensolfird` here) |
| `.github/workflows/gate.yml` | The gate: nine required checks, one job each |
| `rulesets/main.json` | The branch ruleset: required checks, required review, code owner review, no force pushes, no bypass |
| `gate/baseline.json` | The limits the gate enforces. The ratchet lets them tighten and never loosen |
| `scripts/` | Lane classifier, suppressions check, ratchet check, diff coverage, weekly audit |
| `audit/` | The audit fixture and one filled example record |
| `policy/change-management-clause.md` | A paste-ready clause that names the gate as an approving control |
| `docs/` | Copilot approval setup, Aikido, bypass tests, an internal runbook (green lane) |
| `scripts/demo-prs.md` | Four pull requests to open to see the gate work |
| `TODO.md` | What to replace, pin and verify before you publish |

## The gate

Nine checks. Each is a required check, and each runs locally with the same command.

| Check (job name) | What it proves | Command | Tool |
|---|---|---|---|
| `types` | The code compiles and the contracts hold | `npm run gate:types` | tsc, strict mode |
| `tests` | Tests pass, and changed lines are covered | `npm run gate:tests`, `npm run gate:diff-coverage` | vitest, diff-cover |
| `lint` | One house style and no known bug patterns | `npm run gate:lint` | ESLint, type-aware |
| `complexity` | New code stays readable | `npm run gate:complexity` | ESLint complexity and size rules |
| `architecture` | Layers hold and no import cycles appear | `npm run gate:architecture` | dependency-cruiser |
| `security` | No new known hole | `npm run gate:semgrep`, `gate:gitleaks`, `gate:osv` | Semgrep, gitleaks, OSV-Scanner |
| `suppressions` | No new lint or type suppression, skipped test or deleted test | `npm run gate:suppressions` | `scripts/suppressions.ts` |
| `ratchet` | No limit got looser than on the base branch | `npm run gate:ratchet` | `scripts/ratchet.ts` |
| `lane` | Which lane the change is in | `npm run gate:lane` | `scripts/lane.ts` |

`npm run gate:local` runs the checks that need no Docker. The three security commands run their scanners in Docker images pinned by digest.

Mutation testing (`npm run test:mutation`, Stryker) is not a required check yet. Add it when you know what it costs in CI time.

### Stopping the agent from cheating the gate

- **Protect the rules.** The gate's own configuration, thresholds, scripts and CI files are red, with a code owner who is a person. The agent cannot approve for that team.
- **Fail on suppressions.** A new lint or type suppression, a skipped test or a deleted test fails the `suppressions` check.
- **Only tighten.** Every limit starts at today's level. The `ratchet` check compares `gate/baseline.json` with the base branch, and a looser limit fails. The complexity ESLint config, the vitest thresholds and the diff-coverage script read their limits from that one file.
- **The strictest lane wins.** A change that touches one red file is red. A path the classifier cannot read is red. So is a dotfile at the repository root that no rule names.

The `suppressions` check has no override. If a test must go, the gate owners change the rule in a reviewed pull request first.

## How the lane classifier decides

`scripts/lane.ts` reads the changed files and prints `green`, `amber` or `red`.

```bash
npx tsx scripts/cli.ts lane docs/internal/runbook.md            # green
npx tsx scripts/cli.ts lane docs/internal/runbook.md src/money.ts   # amber
npx tsx scripts/cli.ts lane docs/internal/runbook.md .github/workflows/gate.yml   # red
```

## Fork and set up (target: 30 minutes)

You need a GitHub organization on a plan that includes Copilot code review, and Docker for the security scans.

1. **Fork or copy this repository** into your organization. Keep `main` as the default branch.
2. **Replace the owner.** In `.github/CODEOWNERS`, replace `@juliensimon` with your team of people.
3. **Run the gate locally.** `npm ci`, then `npm run gate:local`. Then run the three scans: `npm run gate:semgrep`, `npm run gate:gitleaks`, `npm run gate:osv`.
4. **Open one pull request** so the nine checks run once on GitHub.
5. **Import the ruleset.** In the repository settings, import `rulesets/main.json` as a branch ruleset. It requires the nine checks, one approval, a code owner review, and a fresh approval after each push. It blocks force pushes and lists no bypass actor.
6. **Enable Copilot approvals** with the steps in `docs/copilot-approval.md`. Enter `docs/internal/**` as the only path.
7. **Connect Aikido** as described in `docs/aikido.md`. No secret goes in the repository.
8. **Sign the lane page.** Fill the sign-off table in `LANES.md`.
9. **Run the bypass tests** in `docs/bypass-tests.md` on a throwaway repository and fill in the table below.
10. **Adopt the policy clause** in `policy/change-management-clause.md` and show the auditor the first weekly record.

Before you publish a fork, work through `TODO.md`.

## The weekly audit

`scripts/audit.ts` reads a JSON list of the week's pull requests and writes `audit/records/YYYY-WW.md`. It picks:

- the three AI-approved changes closest to the red lane,
- the three held changes closest to the green lane,
- a random sample of the other AI-approved changes (seeded, so a sample can be reproduced).

A person fills the verdict column. An audit is clean when the person finds no wrong approval. A wrong approval pauses AI approval for that category until a new rule covers it. The closeness score (`redProximity`, 0 to 1) comes from the second model that does the audit. The script only ranks it.

```bash
npm run audit -- --input audit/fixtures/prs-2026-w48.json --seed 7
```

`audit/records/2026-48.md` is a filled example built from fixture data. These are not real pull requests.

## Bypass test results

Each row is an attempt to get a change past the gate. Procedures are in `docs/bypass-tests.md`. A result is what we observed on this repository.

| Test | Attempt | Result |
|---|---|---|
| Admin bypass | An administrator merges with a failing required check, or pushes straight to `main` | Refused both times. The merge of [#4](../../pull/4) failed with "Required status check suppressions is failing", and the push to `main` was rejected by the repository rule. |
| Mixed-path change | One pull request changes a green file and an amber file | Held. Copilot reviewed [#3](../../pull/3) and its approval did not count. The merge stayed blocked. |
| New commit after approval | Push a commit after Copilot approved | Held. On [#1](../../pull/1) the approval was dismissed and the merge blocked until Copilot reviewed the new commit. |
| Code owner required plus Copilot approval | Copilot approves a change to a path that has a code owner | NOT YET TESTED. On [#2](../../pull/2) the path was not on Copilot's list, so Copilot only commented and a code owner approved. |
| Agent edits its own gate config | A change loosens a limit in `gate/baseline.json` | Held. `ratchet` failed on [#6](../../pull/6). |
| Agent deletes a test | A change skips or deletes a test | Held. `suppressions` failed on [#4](../../pull/4) and [#5](../../pull/5). |

Two more things the run showed. The Semgrep rule sets in `gate:semgrep` reported nothing on `eval`, on a shell command built from a string, or on an MD5 hash, while gitleaks caught the key. And Aikido, connected to this repository, flagged that the CI checkout left the Git token in the workflow, which the other scanners missed. Run more than one scanner.

## Develop

Node 22 or later. Strict test-first: write the acceptance test from the spec, watch it fail, then write the code.

```bash
npm ci
npm test                 # all tests
npm run gate:tests       # tests with coverage thresholds
npm run test:mutation    # Stryker on the lane classifier and the invoice code
```

## License

MIT. See `LICENSE`.
