# Change management clause: automated approval gate

Paste the clause below into your change-management policy. Replace each item in square brackets. Have your legal, security and audit owners review it before you adopt it, and rewrite any existing sentence that requires a peer review by a person, because the clause below conflicts with it.

---

## [X.Y] Automated approval gate

**Control.** The Automated Approval Gate (the "Gate") is an approving control for changes to source code. When the Gate approves a change, that approval satisfies the requirement that a change is approved before it is implemented.

**Scope.** The Gate approves changes in the green lane only. The green lane is the set of path patterns in the lane page of each in-scope repository, in the file `LANES.md`. A change is in the green lane only if every file it touches matches a green pattern. At adoption, the green lane is internal documentation. A category joins the green lane one at a time, after clean weekly audits, by a reviewed change to the lane page.

**Rule version.** The Gate's rules carry a version number, recorded in `gate/lanes.json`. Each approval records the rule version in force. This clause covers rule version [1.0.0] and later versions that the Gate owner approves.

**Owner.** [Name and role] owns the Gate and its rules, and signs each weekly audit. [Name and role] is the named deputy.

**What the Gate requires.** The Gate approves a change only when every required check passes with no new finding against the baseline. The checks are builds and types, tests with coverage of changed lines, lint, complexity and size, architecture rules, security and supply chain, a check for new suppressions and deleted tests, a check that no limit has loosened, and the lane classification.

**What goes to a person.** A person approves every change that is not in the green lane. A person from the Gate owners always approves a change to a red-lane path. The red lane covers the Gate's own configuration, continuous integration and review rules, dependencies, security and permissions, database migrations, and AI features (prompts and evaluation sets). A person also approves any change where a regulation or a contract names a person as approver. Any engineer can ask for a human review of any change, and the request is always granted.

**Separation of roles.** The author, the approver and the merger of a change are different identities. The approving identity holds no production credentials. The Gate cannot approve a change to the files that define the Gate.

**Record.** Each approval carries a label, the result of each check, the rule version and the approver identity. Records are kept for [retention period].

**Audit.** Each week, a model other than the approving model selects, from that week's pull requests, the three AI-approved changes closest to the red lane, the three held changes closest to the green lane, and a random sample of the other AI-approved changes. A person decides each case and writes the verdict in the weekly audit record. The audit is clean when the person finds no wrong approval. A wrong approval pauses automated approval for the affected category until a new rule covers it. The Gate owner signs each record.

**Review.** The Gate owner reviews this clause and the lane page [every N months] and after any wrong approval.

---

## Notes for the policy owner

- Name your own standard and control number where the clause says [X.Y].
- Show the auditor the weekly audit records from the first week. The first weeks run in advisory mode, where the AI states whether it would approve and people still approve everything.
- This clause is a template, not legal advice.
