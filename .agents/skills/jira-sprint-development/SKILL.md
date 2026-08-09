---
name: jira-sprint-development
description: Execute this repository's Jira-style stories one ticket at a time with planning, acceptance-criteria tracking, tests, and a review-ready completion summary.
---

# Jira Sprint Development

## When to use
Use whenever the user asks to start, continue, implement, review, or finish a KODI Jira ticket or sprint.

## Inputs
- Ticket ID from `docs/JIRA_BACKLOG.md`.
- Existing repository state.
- Relevant architecture/docs.

## Workflow
1. Read `AGENTS.md`.
2. Locate the exact ticket.
3. Restate the ticket ID, goal, dependencies, and acceptance criteria.
4. Inspect relevant existing files.
5. Identify the smallest implementation plan.
6. If a dependency is missing, stop expanding scope and report the dependency.
7. Implement only the ticket.
8. Add/update tests.
9. Run lint, tests, and build.
10. Check each acceptance criterion explicitly.
11. Summarize:
   - ticket,
   - files changed,
   - acceptance criteria result,
   - commands/tests run,
   - assumptions,
   - suggested next ticket.

## Guardrails
- One ticket at a time.
- No opportunistic refactor unless needed for acceptance criteria.
- Never mark an item complete without evidence.
- Do not change ticket status unless asked.
