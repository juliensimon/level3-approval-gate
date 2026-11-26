# Copilot approval setup

Goal: GitHub Copilot approves a pull request that touches only the green lane, and its approval counts toward the required approval in `rulesets/main.json`. A person approves everything else.

## What the documentation says

The sources are the GitHub documentation and changelog for Copilot approvals. A Copilot approval can satisfy your repository's required-approval rule the same way a teammate's approval would.

Three switches control it. Each one sits at a different level, and each one is off by default.

## Setup steps

Do these on a throwaway repository first.

1. **Enterprise.** An enterprise owner enables the policy "Allow Copilot to approve pull requests". It is disabled by default.
2. **Organization.** An organization owner opens Settings > Copilot > Code review and enables "Count Copilot approvals toward merge requirements".
3. **Repository.** A repository admin opens Settings > Copilot > Code review > Approvals and turns on "Allow Copilot to approve pull requests". On this repository (personal account, Copilot Pro) the page shows that one switch and a path box. An organization may show a second switch for counting approvals toward merge requirements: turn it on too.
4. **File paths.** In the box "Limit approvals to certain file paths", enter one glob per line, up to 15. Enter the green lane from `LANES.md`:

   ```
   docs/internal/**
   ```

   Keep this list identical to the `green` list in `gate/lanes.json`. When you add a green category, change both in the same pull request, and have the gate owners approve it.
5. **Ruleset.** Import `rulesets/main.json` so the approval counts under the required-approval rule and the nine checks are required. See the README.

## What this repository showed

Each point was tested on this repository. The README bypass table links the pull requests.

- **Code owners.** A Copilot approval does not replace a code owner. In [#12](../../pull/12), `prompts/**` was on Copilot's path list, Copilot approved, and GitHub still blocked the merge. Even so, keep code-owned paths off Copilot's list: a Copilot approval on them adds nothing.
- **Personal accounts.** Copilot approvals are available on a public repository in a personal account with a Copilot Pro plan.
- **Mixed paths.** An approval counts only when every changed file matches a configured path. In [#3](../../pull/3), one file was outside the list, Copilot wrote "approval recommended", and the merge stayed blocked.
- **New commits.** A new commit dismisses a Copilot approval. In [#1](../../pull/1), the merge stayed blocked until Copilot reviewed the new commit.

The enterprise and organization steps above were not tested here, because this repository is in a personal account.
