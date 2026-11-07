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

REQ-0012 arrives together with REQ-0004 (order 6 and 7 are one delivery). It comes after REQ-0003 and REQ-0010 (order 4 and 5). The "Next up" card's "Join lobby" and "Leave lobby" buttons need `joinedByMe` on `Lobby` (ADR 0014, point 5), which is REQ-0005 work, so they came with REQ-0005.

Delivered (2026-11-05): REQ-0005 in PR #50. REQ-0012 in PRs #42, #43, #45–#48 and #50 (the Next up buttons came with REQ-0005). REQ-0006 in PR #53. REQ-0008 in PR #54. All eleven MVP requirements (orders 1–11) and amendments AM1–AM5 are delivered.

REQ-0009 comes before REQ-0003 because the game choice and the default max value in REQ-0003 read from the game list.

REQ-0010 comes right after REQ-0009 because it is the only way to change the game list in the app. No other requirement depends on REQ-0010, so it does not block the core flow; the starting content in REQ-0009 is enough to get started.

REQ-0007 comes before REQ-0006. Leaving revokes the leaver's links (decision in REQ-0006), which requires the revocation from REQ-0007.

REQ-0006 comes after REQ-0005 because leaving removes player status.

REQ-0004 contains both the list view (F-004) and the calendar view (F-017). These are delivered together because they show the same data.

REQ-0002 and REQ-0007 have been extended with max uses on invite links (mandatory, 1–10) and group admins' overview of all links. The dependencies in the table are unchanged.

## Amendments decided 2026-11-04

Changes to delivered requirements, decided by the user (DECISION, user, 2026-11-04). They are not new requirements and they add no feature. They change the UI built for REQ-0002, REQ-0003, REQ-0004, REQ-0007 and REQ-0012, and they are delivered before the MVP release. AM2, AM3 and AM5 change the same form or the same calendar, so they are one delivery. AM4 is a separate delivery (invite popover); it shares the group view with AM2 and AM3, and the UI expert may combine them.

| Order | Requirement | Title | Priority | Depends on |
|---|---|---|---|---|
| AM1 | REQ-0012 (Third amendment) | "+" (Create group) only on `/groups` | Must | REQ-0012 |
| AM2 | REQ-0003 (Amendment 2026-11-04) | Create lobby form opened by a button | Must | REQ-0003 |
| AM3 | REQ-0004 (Amendment 2026-11-04) | Create lobby from a day in the week view | Must | REQ-0003, REQ-0004 |
| AM4 | REQ-0002 and REQ-0007 (Amendment 2026-11-04), REQ-0012 (Fourth amendment) | Invite from a popover (Group rail right-click, Invite button), no invite links section in the group view, links valid 10 minutes, default max uses 1 | Must | REQ-0002, REQ-0007, REQ-0012 |
| AM5 | REQ-0004 (Amendment 2026-11-04, time grid), REQ-0012 (Fifth amendment), REQ-0003 (item 3) | Week view and This week as a time grid showing lobby duration; create from an empty time, prefilled with date and start time | Must | REQ-0003, REQ-0004, REQ-0012, AM3 |

Delivered (2026-11-05): AM1 in PR #45, AM2 and AM3 in PR #45, AM4 in PR #48, AM5 in PR #47.

## Should, after the MVP

Not part of the MVP. The vision lists it as outside the MVP scope. It is prioritized after the MVP core flow (orders 1–10) is delivered and used. The user has decided it stays after the MVP (REQ-0011). If the user moves it into the MVP, it goes between REQ-0005 and REQ-0007.

| Order | Requirement | Title | Priority | Depends on |
|---|---|---|---|---|
| A1 | REQ-0014 | Game genre themes | Should | REQ-0004, REQ-0010, REQ-0012 (themes on the views); amends REQ-0009 |
| A2 | REQ-0011 | Game roles and role slots in lobbies | Should | REQ-0005, REQ-0009, REQ-0010 |

Confirmed by the user on 2026-11-04: game roles (REQ-0011) stay after the MVP (DECISION, user).

Order decided by the user on 2026-11-07: genre themes (REQ-0014) come first, ahead of game roles (REQ-0011). The user asked for the genre themes now ("we also need more gaming aesthetics"). Game roles stay Should and follow directly. REQ-0014 needs no game roles and can be delivered on its own.

## Could, after the MVP

Ordered after the Should items, because priority comes first. Not yet a requirement: the requirement is written after the MVP, as F-030 (Decided) with the same scope as before.

| Order | Requirement | Title | Priority | Depends on |
|---|---|---|---|---|
| B1 | – (to be written, F-030) | Game presentation: logo and per-game accent color (the accent color overrides the genre theme of A1, F-032) | Could | REQ-0009, REQ-0010 (amends REQ-0009), REQ-0014 (for the accent override) |
| C1 | REQ-0013 | Landing hero with 3D lobby cards | Could | REQ-0001 (landing page exists), REQ-0014 (themes and motifs for the sample cards, Amendment 2026-11-07) |

Ordering reason: B1 is after A2 because A2 is prioritized higher. Both A2 and B1 extend the game form (F-025) and amend REQ-0009, so the architect should review them together when B1 is written, to avoid two rounds of changes to the same form and data model. B1 has no dependency on A2 and can be moved earlier by the user at any time. B1's accent color overrides the genre theme's accent color for its game (DECISION, user, 2026-11-07).

C1 is after B1 because no core flow depends on it, and it adds a visual only. It is `Could` by the product owner's judgment; the user asked for it and may move it earlier. The three.js dependency is decided in ADR 0015. Open questions in REQ-0013 (decorative preview, landing copy with a lobby step) are decisions for the user and are not blocking.

The item goals idea (F-031) is `Proposed`, decision postponed until the MVP has been used. It is not ordered here.

## Technical tasks (operations)

Technical improvements found while building the operations base. They are not user functionality, so they have no requirement or feature entry. They are not ordered against the MVP requirements above, but all four must be done before the first production deployment.

1. **Secret scanning in pre-commit and CI.** Block committed secrets locally and in CI. Owner: architect (tool choice, new dependency), devops-expert (implementation). Reference: CLAUDE.md, Security; a new ADR is needed for the tool.
2. **Automated PostgreSQL backups with a tested restore.** Scheduled backups, and a restore that has been tested, not only configured. Owner: devops-expert. Reference: ADR 0008.
3. **Monitoring of TLS certificate expiry.** Alert before the certbot margin runs out. Owner: devops-expert. Reference: ADR 0009 (and ADR 0008, operations responsibility).
4. **CI jobs that need service code.** Network-membership check (ADR 0008 review 5) and smoke test in CI (ADR 0009 review 5). Owner: devops-expert. Reference: ADR 0008, ADR 0009. Notes: `bash infra/smoke-test.sh` passed locally against the full dev stack on 2026-11-02 (commit e7305a9). In CI it needs infra/.env from .env.example, dev certs and image tags, and it calls Discord, which adds external flakiness.

## Later

Ideas outside the MVP are listed in `features.md` with status `Proposed`. They are prioritized only after the MVP is delivered and the user has seen how it is used.
