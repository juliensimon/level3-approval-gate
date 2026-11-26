# Runbook: running the gate

This page is internal documentation. It sits in the green lane, so an AI approver may approve changes to it once the gate setup is complete.

## Before you open a pull request

Run the same checks CI runs:

```bash
npm ci
npm run gate:local
```

## When a check fails

| Check | What it means | First thing to try |
|---|---|---|
| types | The code does not compile | Read the first error, fix the type |
| tests | A test fails or coverage dropped | Run `npm test` and read the failing test |
| lint | A rule is broken | Run `npm run gate:lint` |
| complexity | A function or file is too big | Split it |
| architecture | An import crosses a layer | Move the code, do not add an exception |
| security | A scanner found a finding | Read the finding, fix the cause |
| suppressions | You added a suppression, skipped a test or deleted a test | Remove it and fix the cause |
| ratchet | A limit got looser | Put the limit back. Only the gate owners tighten limits |

## Who to ask

The gate owners named in `.github/CODEOWNERS` own the rules. Any engineer can ask for a human review of any change.
