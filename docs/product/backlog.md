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
| A2 | REQ-0011 | Game roles and role slots in lobbies (amended by REQ-0015: roles may sit on a mode) | Should | REQ-0005, REQ-0009, REQ-0010 |
| A3 | REQ-0015 | Game modes, named activities and open lobbies | Should | REQ-0003, REQ-0004, REQ-0005, REQ-0009, REQ-0010, REQ-0011 (roles on modes); REQ-0012 (labels on the dashboard); REQ-0014 (genre theme on the lobby's game) |

Confirmed by the user on 2026-11-04: game roles (REQ-0011) stay after the MVP (DECISION, user).

Delivered (2026-11-08): A1 (REQ-0014, game genre themes) in PR #70. The landing hero criterion of REQ-0014 is not part of it; it is delivered with C1 (see below).

Order decided by the user on 2026-11-07: genre themes (REQ-0014) come first, ahead of game roles (REQ-0011). The user asked for the genre themes now ("we also need more gaming aesthetics"). Game roles stay Should and follow directly. REQ-0014 needs no game roles and can be delivered on its own.

Order decided by the user on 2026-11-08 (question 12): A2 (REQ-0011, game roles) and A3 (REQ-0015, modes, named activities and open lobbies) are delivered together, after A1 (REQ-0014). Reason: both change the same game form (F-025), the same lobby data and the role slots, so game roles are not built on the game and then moved to a mode. The open-lobby slice (F-034) is not built first on its own.

Order decided by the user on 2026-11-10 ("the app feels too simple"): A4 to A7 follow A3.

DECISION (user, 2026-11-10): no, A4 to A6 are not moved ahead of A2 and A3, which are in progress. ADR 0017 is finished first (PR5b, PR5c, PR6), then A4 to A6. The architect designs them in parallel: ADR 0018 (A4, F-029), ADR 0019 (A5, F-035) and ADR 0020 (A6, F-036, with ADR 0019), all Proposed.

| Order | Requirement | Title | Priority | Depends on |
|---|---|---|---|---|
| A4 | REQ-0016 | Discord avatars for users (F-029) | Should | REQ-0001, REQ-0002, REQ-0004, REQ-0012 (amended by REQ-0016) |
| A5 | REQ-0017 | Live lobby updates on open screens (F-035) | Should | REQ-0004, REQ-0005, REQ-0012 (amended by REQ-0017); needs an ADR for the transport |
| A6 | REQ-0018 | Group feed of recent lobby events (F-036) | Should | REQ-0003, REQ-0004, REQ-0005; REQ-0017 for new entries shown live |
| A7 | – (F-037, not yet a requirement) | Member availability and group heatmap ("When can everyone play?") | not yet prioritised | REQ-0002, REQ-0003 (lobby from a suggested slot) |

A7 is not a requirement yet. Parked by the user on 2026-11-10 (F-037, Proposed): it is taken up after A4 and A5 are under way. It is written after the questions below are answered.

Open questions for A7 (F-037), kept here so they are not lost:
1. Are "usual times" a weekly pattern, dated slots, or both?
2. Slot size: whole hours, half hours, or free time ranges?
3. Time zones: members are in different zones. Is a slot stored in each member's local time (vision: each member sees local time), and how is the heatmap shown then?
4. Visibility: can members see who is free at a slot, or only a count per slot?
5. Per group, or one availability for all groups?
6. What is "best time"? Top slots, a minimum number of members, or a colour scale?
7. Should a slot need a minimum number of free members before a suggestion is shown?
8. Should availability expire, or be asked again after a time?
9. Leaving a group removes that member's availability (draft: yes)?

Ideas assessed on 2026-11-10 without a new requirement: "Play now" ping and Discord reminders are EXTEND F-015 (F-015 stays Proposed, not ordered). Group statistics are REJECTED. Game presentation: DUPLICATE OF F-030 (B1). Recurring lobbies: DUPLICATE OF F-014 (Proposed).

## Could, after the MVP

Ordered after the Should items, because priority comes first. Not yet a requirement: the requirement is written after the MVP, as F-030 (Decided) with the same scope as before.

| Order | Requirement | Title | Priority | Depends on |
|---|---|---|---|---|
| B1 | – (to be written, F-030) | Game presentation: logo and per-game accent color (the accent color overrides the genre theme of A1, F-032) | Could | REQ-0009, REQ-0010 (amends REQ-0009), REQ-0014 (for the accent override) |
| C1 | REQ-0013 | Landing hero with 3D lobby cards | Could | REQ-0001 (landing page exists), REQ-0014 (themes and motifs for the sample cards, Amendment 2026-11-07) |

Ordering reason: B1 is after A2 because A2 is prioritized higher. Both A2 and B1 extend the game form (F-025) and amend REQ-0009, so the architect should review them together when B1 is written, to avoid two rounds of changes to the same form and data model. B1 has no dependency on A2 and can be moved earlier by the user at any time. B1's accent color overrides the genre theme's accent color for its game (DECISION, user, 2026-11-07).

C1 is after B1 because no core flow depends on it, and it adds a visual only. It is `Could` by the product owner's judgment; the user asked for it and may move it earlier. The three.js dependency is decided in ADR 0015. The decorative preview question in REQ-0013 is decided (DECISION, user, 2026-11-08: removed, see REQ-0013 Amendment 2026-11-08). The open question in REQ-0013 (landing copy with a lobby step) is a decision for the user and is not blocking.

Delivered (2026-11-08): C1 (REQ-0013, landing hero) in PR #72, with the removals of REQ-0013 Amendment 2026-11-08 and the steps in one column. Its REQ-0014 criterion (sample cards with genre themes) is delivered with it.

The item goals idea (F-031) is `Proposed`, decision postponed until the MVP has been used. It is not ordered here.

## Technical tasks (operations)

Technical improvements found while building the operations base. They are not user functionality, so they have no requirement or feature entry. They are not ordered against the MVP requirements above, but all four must be done before the first production deployment.

1. **Secret scanning in pre-commit and CI.** Block committed secrets locally and in CI. Owner: architect (tool choice, new dependency), devops-expert (implementation). Reference: CLAUDE.md, Security; a new ADR is needed for the tool.
2. **Automated PostgreSQL backups with a tested restore.** Scheduled backups, and a restore that has been tested, not only configured. Owner: devops-expert. Reference: ADR 0008.
3. **Monitoring of TLS certificate expiry.** Alert before the certbot margin runs out. Owner: devops-expert. Reference: ADR 0009 (and ADR 0008, operations responsibility).
4. **CI jobs that need service code.** Network-membership check (ADR 0008 review 5) and smoke test in CI (ADR 0009 review 5). Owner: devops-expert. Reference: ADR 0008, ADR 0009. Notes: `bash infra/smoke-test.sh` passed locally against the full dev stack on 2026-11-02 (commit e7305a9). In CI it needs infra/.env from .env.example, dev certs and image tags, and it calls Discord, which adds external flakiness.

## Later

Ideas outside the MVP are listed in `features.md` with status `Proposed`. They are prioritized only after the MVP is delivered and the user has seen how it is used.
