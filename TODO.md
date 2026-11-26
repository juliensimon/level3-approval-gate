# TODO

## When you fork

- [ ] `.github/CODEOWNERS`: replace `@juliensimon` and `@juliensolfird` with your team of people, never an agent or a bot.
- [ ] `LICENSE`: put your own copyright holder on your changes.
- [ ] `LANES.md`: fill the sign-off table (legal, security, insurance, gate owner).
- [ ] `policy/change-management-clause.md`: fill the items in square brackets in your own copy of the clause.
- [ ] Re-read the Docker image digests in `package.json` (`gate:semgrep`, `gate:gitleaks`, `gate:osv`) and decide who refreshes them and when. The lookup is `docker buildx imagetools inspect IMAGE:latest --format '{{.Manifest.Digest}}'`. A digest change is a red-lane change.
- [ ] Run the six bypass tests in `docs/bypass-tests.md` on your own setup. The results below hold for this repository only.

## Verified on this repository

- [x] Actions pinned to full commit SHAs, diff-cover pinned to 11.0.4, Docker images pinned by digest.
- [x] The nine checks ran on GitHub runners and the ruleset in `rulesets/main.json` enforces them (`integration_id: 15368`).
- [x] An administrator cannot merge a pull request with a failing required check, and a direct push to `main` is rejected.
- [x] A Copilot approval counts only when every changed file matches a configured path ([#3](../../pull/3)).
- [x] A new commit dismisses a Copilot approval ([#1](../../pull/1)).
- [x] A Copilot approval does not replace a code owner ([#12](../../pull/12)).
- [x] Copilot approvals work on a public repository in a personal account with a Copilot Pro plan.

## Still open

- [ ] Aikido: whether it can report a status check that blocks merges, on which plan, and under which name. On this repository's plan it scans but adds no check. See `docs/aikido.md`.
- [ ] The pattern `/.*` in `.github/CODEOWNERS`: confirm it matches root dotfiles and dot-directories in GitHub's matching. The repository test uses the `ignore` package as a stand-in.
- [ ] The enterprise and organization Copilot settings in `docs/copilot-approval.md` were not tested here, because this repository is in a personal account.
- [ ] `pull_request` workflows run the workflow file from the pull request. Here `.github/**` is red and has a code owner, so a person approves any edit to `gate.yml`. For a stronger setup, run the gate as an organization-level required workflow from a separate repository. Not tested here.
- [ ] Merge queue is not covered. The workflow has no `merge_group` trigger.
- [ ] The "30 minutes" setup target in the README has not been timed.
- [ ] `docs/internal/**` also admits non-Markdown files in that folder. Consider narrowing it to `docs/internal/**/*.md` in `gate/lanes.json`, `LANES.md`, `.github/CODEOWNERS` and the Copilot path list together.
- [ ] `osv-scanner.toml` ignores one advisory (`GHSA-g3hv-75wg-m249`, a transitive development dependency of Stryker). Remove the entry when a fixed version exists.
