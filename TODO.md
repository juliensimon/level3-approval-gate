# TODO

## Before publishing

Placeholders to replace:

- [x] `.github/CODEOWNERS`: owner is `@juliensimon`. A fork replaces it with a team of people, never an agent or a bot.
- [ ] `LICENSE`: confirm the copyright holder.
- [ ] `LANES.md`: fill the sign-off table (legal, security, insurance, gate owner).
- [ ] `policy/change-management-clause.md`: fill the items in square brackets in your own copy of the clause.

Pins to look up (not verifiable offline):

- [ ] Pin `actions/checkout@v4` and `actions/setup-node@v4` to full commit SHAs in `.github/workflows/gate.yml` and `.github/actions/setup/action.yml`. They use version tags now. `tests/meta/github-config.test.ts` accepts a tag or a 40-character SHA.
- [ ] Pin `pip install diff-cover` in `gate.yml` to a version. The run in this repository used diff-cover 11.0.4 with the lcov report.
- [ ] Re-read the Docker image digests right before publishing, because `latest` moves. Each one is already pinned by digest in `package.json` (`gate:semgrep`, `gate:gitleaks`, `gate:osv`). The lookup is `docker buildx imagetools inspect IMAGE:latest --format '{{.Manifest.Digest}}'`, then paste `IMAGE@sha256:...` into the script. `tests/meta/github-config.test.ts` fails on any unpinned `docker run` and on the text `REPLACE_WITH_DIGEST`.
- [ ] Decide how digests get refreshed (a person, on a schedule). A digest change is a red-lane change.

## Unverified

Nothing below was checked against GitHub or a vendor. Do not rely on it until you have.

Ruleset (`rulesets/main.json`):

- [ ] `integration_id: 15368` on every required check. This is the GitHub Actions app id from memory. Confirm against the GitHub rulesets API docs before publishing.
- [ ] The overall JSON shape and field names for the branch ruleset import: `target`, `enforcement`, `conditions.ref_name`, `~DEFAULT_BRANCH`, `bypass_actors`, the rule types `deletion`, `non_fast_forward`, `pull_request`, `required_status_checks`, and the parameter names `required_approving_review_count`, `dismiss_stale_reviews_on_push`, `require_code_owner_review`, `require_last_push_approval`, `required_review_thread_resolution`, `strict_required_status_checks_policy`.
- [ ] That a required check is matched by the job's `name` (no matrix jobs are used).
- [ ] The menu path for importing a ruleset in the GitHub settings.
- [ ] That an empty `bypass_actors` list also removes bypass for organization and repository administrators on your plan. Bypass test 1 checks it.

CODEOWNERS:

- [ ] That the pattern `/.*` in `.github/CODEOWNERS` matches root dotfiles and dot-directories as intended in GitHub's matching. The repository test uses the `ignore` package (gitignore rules) as a stand-in.

Copilot approvals (`docs/copilot-approval.md`):

- [x] How a Copilot approval behaves on a path that has a code owner. Tested in [#12](../../pull/12): Copilot approved, and the merge stayed blocked until a code owner approved.
- [x] Whether Copilot approvals are available on a personal account. Yes, on a public repository with a Copilot Pro plan. The settings page shows one switch and a path box.
- [ ] That an approval counts only when every changed file matches a configured path.
- [ ] That a new commit dismisses a Copilot approval.

Aikido (`docs/aikido.md`):

- [ ] Verify against the Aikido documentation that Aikido can report a status check that blocks merges, and on which plan.
- [ ] Verify the name of that status check, if one exists.
- [ ] If Aikido should run from CI, take the exact syntax from the Aikido documentation.

Hardening to evaluate:

- [ ] `pull_request` workflows run the workflow file from the pull request. Here `.github/**` is red and has a code owner, so a person approves any edit to `gate.yml`. For a stronger setup, run the gate as an organization-level required workflow from a separate repository. Not tested here.
- [ ] Merge queue is not covered. The workflow has no `merge_group` trigger.

Measured claims:

- [ ] The "30 minutes" setup target in the README has not been timed.
- [ ] Tests, types and lint ran locally on Node 26 and on Node 22.23.5. The workflow itself has not run on a GitHub runner. Open one pull request and confirm all nine jobs.

## Open decisions

- [ ] `docs/internal/**` is the whole green lane. The pattern also admits non-Markdown files placed in that folder. Consider narrowing it to `docs/internal/**/*.md` in `gate/lanes.json`, `LANES.md`, `.github/CODEOWNERS` and the Copilot path list together.
- [ ] `osv-scanner.toml` ignores one advisory (`GHSA-g3hv-75wg-m249`, a transitive development dependency of Stryker). Remove the entry when a fixed version exists.
