# Aikido

Aikido is a commercial security platform. It is the security scanner chosen for this setup. This page says how it connects and what it does not change.

## How it connects

The repository owner connects the repository in the Aikido dashboard, through Aikido's GitHub integration. The connection is made in the dashboard and in GitHub's authorization screens.

- No Aikido secret, token or API key goes in this repository.
- No Aikido step is in `.github/workflows/gate.yml`.
- Do not paste any Aikido credential into an issue, a pull request or a workflow file.

## What stays required

The open source scanners in `gate.yml` stay the required checks: Semgrep, gitleaks and OSV-Scanner, in the job named `security`. They run on every pull request and anyone can read how they run.

Aikido does not replace them until you confirm that Aikido blocks merges on your plan. When you have confirmed it, record the check name Aikido reports to GitHub, add it to the required checks in `rulesets/main.json`, and decide in a reviewed pull request whether to keep the open source scanners as a second scanner.

## Not written here on purpose

This page has no Aikido command line flags and no Aikido workflow syntax. They are not included because they were not verified.

- TODO: verify against the Aikido documentation whether Aikido can report a status check to GitHub that blocks merges, and on which plan.
- TODO: verify against the Aikido documentation the name of that status check, if one exists.
- TODO: if you want Aikido to run from CI, take the exact syntax from the Aikido documentation. Do not copy it from a third-party page.

Changing the scanner setup changes what judges a change, so it is a red-lane change: a person from the gate owners approves it.
