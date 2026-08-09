# Codex Prompt Cookbook

## First task

```text
Read AGENTS.md, docs/ARCHITECTURE.md, docs/JIRA_BACKLOG.md, and the relevant repo skills.
Start KODI-001 only.
First inspect the repository and give me a concise implementation plan mapped to the acceptance criteria.
Then implement the ticket, run lint/tests/build, and give me a Jira-style completion summary.
Do not start KODI-002.
```

## Continue to next ticket

```text
Start KODI-002 only.
Read the ticket and relevant skills first.
Keep MariaDB read-only and do not guess the KODI database suffix.
Implement, test, and report acceptance-criteria evidence.
```

## Ask Codex to review a ticket

```text
Review the current changes for KODI-102 using the testing-review skill.
Do not modify code first.
Check every acceptance criterion, database safety, parameterized SQL, pagination, lint, tests, and build.
List blockers before suggesting fixes.
```

## UI ticket

```text
Start KODI-203 only.
Use the frontend-designer and jira-sprint-development skills.
Keep API access inside apps/web/src/services/api.ts.
Implement responsive mobile/desktop states plus loading, empty, and error behavior.
Run applicable tests and build.
```

## Bug ticket

```text
Create a proposed Jira bug entry for this issue before coding:
<describe bug>
Include reproduction, expected result, actual result, acceptance criteria, and regression test.
Then wait for me to choose the ticket ID/scope.
```

## Sprint review

```text
Review Sprint 1 against docs/JIRA_BACKLOG.md.
For each Sprint 1 ticket, report Done / Not Done based only on repository evidence and tests.
Do not implement missing work unless I ask.
```
