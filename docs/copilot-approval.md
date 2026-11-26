# Copilot approval setup

Goal: GitHub Copilot approves a pull request that touches only the green lane, and its approval counts toward the required approval in `rulesets/main.json`. A person approves everything else.

## What the documentation says

The sources are the GitHub documentation and changelog for Copilot approvals. A Copilot approval can satisfy your repository's required-approval rule the same way a teammate's approval would.

Three switches control it. Each one sits at a different level, and each one is off by default.

## Setup steps

Do these on a throwaway repository first.

1. **Enterprise.** An enterprise owner enables the policy "Allow Copilot to approve pull requests". It is disabled by default.
2. **Organization.** An organization owner opens Settings > Copilot > Code review and enables "Count Copilot approvals toward merge requirements".
3. **Repository.** A repository admin opens Settings > Copilot > Code review. Under Auto-approval, turn on both toggles:
   - "Allow Copilot to approve pull requests"
   - "Allow Copilot approvals to count toward merge requirements"
4. **File paths.** In the same Auto-approval section, enter the optional file paths, one glob per line, up to 15. Enter the green lane from `LANES.md`:

   ```
   docs/internal/**
   ```

   Keep this list identical to the `green` list in `gate/lanes.json`. When you add a green category, change both in the same pull request, and have the gate owners approve it.
5. **Ruleset.** Import `rulesets/main.json` so the approval counts under the required-approval rule and the nine checks are required. See the README.

## Unverified

These points are not in the fact set above. Test each one on the throwaway repository and write the result in the README table. Until then, do not rely on them.

- **VERIFIED: CODEOWNERS.** A Copilot approval does not replace a code owner. In [#12](../../pull/12), `prompts/**` was on Copilot's path list, Copilot approved, and GitHub still blocked the merge. Even so, keep code-owned paths off Copilot's list: a Copilot approval on them adds nothing.
- **VERIFIED: personal accounts.** Copilot approvals are available on a public repository in a personal account with a Copilot Pro plan. The repository settings show one switch, "Allow Copilot to approve pull requests", and a path box.
- **UNVERIFIED: mixed paths.** Whether an approval counts only when every changed file matches a configured path. The design depends on it. Bypass test 2 checks it.
- **UNVERIFIED: new commits.** Whether a new commit dismisses a Copilot approval. Bypass test 3 checks it.
