# Backlog

Prioritized order for the MVP. The order follows the core flow and dependencies: each requirement builds on those above it.

| Order | Requirement | Title | Priority | Depends on |
|---|---|---|---|---|
| 1 | REQ-0001 | Log in with Discord | Must | – |
| 2 | REQ-0002 | Create and join group via invite link | Must | REQ-0001 |
| 3 | REQ-0009 | Game list with default max players | Must | REQ-0001 |
| 4 | REQ-0010 | Manage game list as system admin | Must | REQ-0001, REQ-0009 |
| 5 | REQ-0003 | Create lobby | Must | REQ-0002, REQ-0009 |
| 6 | REQ-0004 | View upcoming lobbies (list and calendar) | Must | REQ-0003 |
| 7 | REQ-0012 | Dashboard and app shell | Must | REQ-0001, REQ-0002, REQ-0003, REQ-0004, REQ-0010 (Game list link on You) (card buttons: REQ-0005) |
| 8 | REQ-0005 | Join and leave lobby | Must | REQ-0004 |
| 9 | REQ-0007 | Revoke invite link | Must | REQ-0002 |
| 10 | REQ-0006 | Leave group | Must | REQ-0002, REQ-0005, REQ-0007 |
| 11 | REQ-0008 | Make member group admin | Must | REQ-0002 |

All eleven requirements are necessary for the MVP, so all are `Must`. No MVP requirement is `Could` or `Should`.

REQ-0012 arrives together with REQ-0004 (order 6 and 7 are one delivery). It comes after REQ-0003 and REQ-0010 (order 4 and 5). The "Next up" card has no "Join lobby" and "Leave lobby" buttons until REQ-0005 is delivered (DECISION, user, 2026-11-04). The buttons need `joinedByMe` on `Lobby` (ADR 0014, point 5), which is REQ-0005 work, not REQ-0012 work. REQ-0005 is delivered before the MVP release, as with REQ-0002 and REQ-0004.

REQ-0009 comes before REQ-0003 because the game choice and the default max value in REQ-0003 read from the game list.

REQ-0010 comes right after REQ-0009 because it is the only way to change the game list in the app. No other requirement depends on REQ-0010, so it does not block the core flow; the starting content in REQ-0009 is enough to get started.

REQ-0007 comes before REQ-0006. Leaving revokes the leaver's links (decision in REQ-0006), which requires the revocation from REQ-0007.

REQ-0006 comes after REQ-0005 because leaving removes player status.

REQ-0004 contains both the list view (F-004) and the calendar view (F-017). These are delivered together because they show the same data.

REQ-0002 and REQ-0007 have been extended with max uses on invite links (mandatory, 1–10) and group admins' overview of all links. The dependencies in the table are unchanged.

## Should, after the MVP

Not part of the MVP. The vision lists it as outside the MVP scope. It is prioritized after the MVP core flow (orders 1–10) is delivered and used. Timing is an open question for the user in REQ-0011. If the user moves it into the MVP, it goes between REQ-0005 and REQ-0007.

| Order | Requirement | Title | Priority | Depends on |
|---|---|---|---|---|
| A1 | REQ-0011 | Game roles and role slots in lobbies | Should | REQ-0005, REQ-0009, REQ-0010 |

## Technical tasks (operations)

Technical improvements found while building the operations base. They are not user functionality, so they have no requirement or feature entry. They are not ordered against the MVP requirements above, but all four must be done before the first production deployment.

1. **Secret scanning in pre-commit and CI.** Block committed secrets locally and in CI. Owner: architect (tool choice, new dependency), devops-expert (implementation). Reference: CLAUDE.md, Security; a new ADR is needed for the tool.
2. **Automated PostgreSQL backups with a tested restore.** Scheduled backups, and a restore that has been tested, not only configured. Owner: devops-expert. Reference: ADR 0008.
3. **Monitoring of TLS certificate expiry.** Alert before the certbot margin runs out. Owner: devops-expert. Reference: ADR 0009 (and ADR 0008, operations responsibility).
4. **CI jobs that need service code.** Network-membership check (ADR 0008 review 5) and smoke test in CI (ADR 0009 review 5). Owner: devops-expert. Reference: ADR 0008, ADR 0009. Notes: `bash infra/smoke-test.sh` passed locally against the full dev stack on 2026-11-02 (commit e7305a9). In CI it needs infra/.env from .env.example, dev certs and image tags, and it calls Discord, which adds external flakiness.

## Later

Ideas outside the MVP are listed in `features.md` with status `Proposed`. They are prioritized only after the MVP is delivered and the user has seen how it is used.
