# Specs

Each spec is a list of numbered requirements. Each requirement has acceptance criteria that a test can check.

- One file per spec: `NNN-name.md`.
- One acceptance test file per spec: `tests/acceptance/spec-NNN-*.test.ts`.
- Each requirement ID (for example `001.2`) appears in the title of at least one acceptance test. `tests/meta/spec-coverage.test.ts` fails if a spec has no acceptance test file or a requirement ID has no test.
- Write the acceptance tests before the code. A person or a second agent writes them from the spec, never the agent that writes the code.

The values in these specs (tiers, rates) are sample business rules for the demo.

| Spec | Subject |
|---|---|
| [001](001-line-totals.md) | Line totals |
| [002](002-volume-discounts.md) | Volume discounts |
| [003](003-tax.md) | Tax |
| [004](004-invoice-totals.md) | Invoice totals |
| [005](005-validation.md) | Input validation |
