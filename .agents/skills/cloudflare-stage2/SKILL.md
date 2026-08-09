---
name: cloudflare-stage2
description: Migrate the KODI web frontend/API toward Cloudflare Pages, Workers, and a D1 read model populated by safe outbound snapshots from KODI MariaDB.
---

# Cloudflare Stage 2

## Preconditions
Do not use this skill for Stage 1 tickets.

Before migration:
- Stage 1 API contract is stable.
- MariaDB schema access is read-only for browser features.
- Stage 2 feasibility ticket is active.

## Target
- React static app -> Cloudflare Pages.
- API -> Cloudflare Worker.
- App-owned read model -> Cloudflare D1.
- A private-LAN sync agent reads MariaDB with SELECT-only credentials and pushes bounded snapshots over authenticated HTTPS.
- Never open NAS MariaDB port 3306 to the public Internet.

## Workflow
1. Inventory Express routes and DTO contracts.
2. Keep route URLs and response shapes stable.
3. Design a minimal app-owned D1 schema rather than copying the KODI schema.
4. Create the Worker read implementation separately before deleting the Node API.
5. Add a separate authenticated, bounded, idempotent snapshot-ingestion path.
6. Keep sync secrets in Cloudflare-managed secrets and the LAN host's secure configuration.
7. Build the local agent with SELECT-only MariaDB access and no raw-path leakage.
8. Verify additions, updates, deletions, retries, stale snapshots, and partial failures.
9. Run contract tests against both API implementations during transition.
10. Switch the frontend only after a complete snapshot and critical-flow validation.

## Rollback
Keep Stage 1 deployment deployable until Stage 2 is proven.
