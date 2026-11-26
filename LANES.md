# Lane page

Rule version: `1.0.0`

This page says which changes the AI may approve in this repository. Three lanes, written as path patterns. The patterns live in `gate/lanes.json`, which is what `scripts/lane.ts` reads. A test fails if this page and that file disagree.

| Lane | Who approves | Rule |
|---|---|---|
| Green | The AI, after every required check is green | Every changed file matches a green pattern |
| Amber | A person | Everything that is not green and not red |
| Red | A person from the gate owners, always | At least one changed file matches a red pattern |

A change takes the strictest lane of its files. A change that touches one red file is red, however small the rest is. A change with no files goes to a person.

## Green: the AI may approve

Start with internal documentation only. A wrong approval here costs little, and you still exercise the whole setup.

- `docs/internal/**`

Documentation that customers or contracts rely on stays with a person, so it does not live in this folder.

## Red: always a person

CI and review rules, the files that judge a change, and the categories where a code check says too little.

CI, review rules and ownership:

- `.github/**`
- `CODEOWNERS`
- `**/CODEOWNERS`
- `rulesets/**`
- `LANES.md`

The gate's own configuration, thresholds and scripts. The agent must not be able to change what judges it:

- `eslint.config.*`
- `eslint.*.config.*`
- `vitest.config.*`
- `stryker.*`
- `tsconfig*.json`
- `.dependency-cruiser.*`
- `osv-scanner.toml`
- `.gitleaks.toml`
- `.semgrep/**`
- `.semgrepignore`
- `gate/**`
- `scripts/**`

Tool configuration that changes how installs, runtimes and hooks behave:

- `.npmrc`
- `.yarnrc*`
- `.nvmrc`
- `.node-version`
- `.husky/**`

Dependencies:

- `package.json`
- `package-lock.json`

Security and permissions:

- `**/security/**`
- `**/auth/**`
- `**/secrets/**`
- `**/permissions/**`

Data:

- `**/migrations/**`

AI features. Code checks say nothing about the quality of a model's output:

- `prompts/**`
- `evals/**`

Add patterns for payment code, personal data handling and consent or legal text when your repository has them.

### Unknown dotfiles at the root are red

Any dotfile or dot-directory at the repository root that no rule names is red. Tools read those files as configuration, and a new one can change how the gate runs. This holds even if a green pattern would match it. Dotfiles below the root follow the normal rules.

## Amber: a person approves

Everything else. A category moves to green only after clean weekly audits, one category at a time.

## How the lane is used

- `npm run gate:lane` prints the lane of a pull request. The `lane` check in CI runs it.
- The green patterns are the file paths you enter in the Copilot auto-approval setting. See `docs/copilot-approval.md`.
- The red patterns are in `.github/CODEOWNERS`, and the ruleset requires a code owner review.
- Paths the classifier cannot read (absolute paths, `..` segments, backslashes) are red. Letter case never decides a lane.

## Sign-off

The lane page needs a signature from whoever owns legal, security and insurance before the AI approves anything.

| Role | Name | Date |
|---|---|---|
| Legal | | |
| Security | | |
| Insurance | | |
| Gate owner | | |
