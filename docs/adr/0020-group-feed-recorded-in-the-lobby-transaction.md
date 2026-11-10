# 0020. Group feed: events recorded in the lobby write transaction
Status: Proposed (2026-11-10)
Requirement: REQ-0018 (F-036). Uses REQ-0016 (ADR 0018, avatars) and REQ-0017 (ADR 0019, the signal).
Amends: ADR 0004 (rules 6 and 7: what a successful write records), ADR 0006 (new table `group_events`).

## Context
- Every lobby write runs under the group lock in one transaction (ADR 0006). The lock-order rules forbid a network call inside the lock. Names live in `auth` (ADR 0003).
- A feed event is recorded when the change is saved, and a denied or failed change records nothing (REQ-0018).
- "Lobby full" is recorded directly after "joined", in the same transaction, so both events can have the same timestamp.
- A lobby keeps copies of its game, mode and named activity names (ADR 0017, section 3). The label is composed in the frontend only (ADR 0017, section 4; glossary "Label").
- Retention: 7 days, at most 20 events (REQ-0018, decided). Events of members who left keep their name.

## Decision

**1. Table `group_events` in `calendar` (migration `0008_group_events.sql`).**

```sql
-- +goose Up
CREATE TABLE group_events (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    seq             bigint GENERATED ALWAYS AS IDENTITY,
    group_id        uuid NOT NULL REFERENCES groups (id) ON DELETE CASCADE,
    kind            text NOT NULL CHECK (kind IN ('lobby_created', 'player_joined', 'player_left', 'lobby_full')),
    occurred_at     timestamptz NOT NULL,
    lobby_starts_at timestamptz NOT NULL,
    game_name       text NULL,
    mode_name       text NULL,
    activity_name   text NULL,
    user_id         uuid NULL,
    CHECK ((kind = 'lobby_full') = (user_id IS NULL))
);
CREATE INDEX group_events_group_id_occurred_at_idx ON group_events (group_id, occurred_at, seq);
GRANT USAGE ON SEQUENCE group_events_seq_seq TO calendar;

-- +goose Down
DROP TABLE group_events;
```

- The `GRANT` is needed because the default privileges of `infra/postgres/init/10-service-databases.sh` cover tables only. Without it, the runtime role `calendar` cannot insert, because the identity column draws its value from the sequence (ADR 0012, amendment 2026-11-02, item 3). The sequence is `group_events_seq_seq`, the name PostgreSQL gives the identity sequence of `seq`. The down part drops the table and with it the sequence.
- The F-1 integration test runs its inserts and reads as the runtime role `calendar`, not as the migration role, so a missing grant fails the test.
- `user_id` has no foreign key, because the user belongs to `auth` (ADR 0006). The table holds user IDs and no names.
- No backfill: the migration inserts no rows, and existing lobbies get no events (DECISION, user, 2026-11-10). The feed starts empty at release.

**2. Which changes record an event (domain, one place).**
- `lobby_created`: a lobby is saved. `user_id` is the creator. The creator's own join gets no `player_joined`.
- `player_joined`: a join saves a new player row. A seat change of an existing player and a no-op join record nothing.
- `lobby_full`: directly after `player_joined`, when the lobby has a limit and the player count equals it. Never for a lobby without a limit.
- `player_left`: a leave deletes a player row. A leave by a non-player records nothing. A leave after the end time still records, because it is saved.
- Nothing else: no event for deleting a lobby, a mode, a named activity or game change, a seat change, or any membership change.
- A denied write (full, ended, not a member, lobby missing) returns an error. The transaction rolls back, so no event is recorded (REQ-0018).

Domain functions return the events of a saved change. The application writes them.

**3. Writes are part of the change.** Inside the same `WithLockedGroup` transaction, after the change and before the commit, the application calls `AddFeedEvent(ctx, event)` on `LobbyTx`, once per event. If the insert fails, the whole change fails. A change never exists without its event, and an event never exists without its change. The signal of ADR 0019 is sent after the commit.

Delete records no event, and it does not write the feed table.

**4. Labels are parts, not text.** The event copies the lobby's `game_name`, `mode_name` and `activity_name` as they are at that moment. The lobby row already holds these copies (ADR 0017), so the event needs no extra query. A later change to the lobby does not change the event, so the event keeps the label it had. `game_name` null means "Open". The backend never composes the label string, so the label rule stays in the frontend (ADR 0017, section 4).

**5. Time.**
- `occurred_at` is the clock time of the write (the `Clock` port). It orders the feed and sets retention. It is not sent to the frontend.
- `lobby_starts_at` is the lobby's start time. The feed line shows it as its time (DECISION, user, 2026-11-10: a feed line shows the lobby's start time). REQ-0018 line 17 ("the time it happened") is superseded for this reason.
- The feed is ordered newest first by when the event happened: `occurred_at DESC, seq DESC`. Each line shows the lobby's start time, but the order follows `occurred_at`. The group lock serializes all writes of a group, so `seq` is the commit order, and it breaks ties, for example "joined" and "Lobby full" in one transaction.

**6. Names and avatars are read live, not copied (DECISION, user, 2026-11-10: the current name).** Reading the feed calls `UserDirectory` (ADR 0018), one lookup for the names and the `hasAvatar` flag. The event holds only the user ID. Reasons:
- ADR 0003: names have one source, and calendar keeps no copy.
- A write must not call `auth`. Today joins and leaves work without `auth`. A copy would need a call before the lock, and joins would then depend on `auth`.
- Members who left keep their name, because their user row stays in `auth`. Their picture is not shown after they leave (ADR 0018).
- A person who renamed themselves shows the new name on older lines. This is accepted.

**7. Retention and reading.**
- `FeedRetention` = 7 days and `FeedLimit` = 20, named constants in the domain.
- Read: rows of the group with `occurred_at > now - FeedRetention`, ordered `occurred_at DESC, seq DESC`, limit `FeedLimit`. No pagination, no "load more". The read filter hides expired events at once.
- Removal: a periodic job in `calendar`. At start, and then every `feedCleanupInterval` (1 hour), it runs `DELETE FROM group_events WHERE occurred_at < now - FeedRetention` for all groups. It stops when the service stops. It is a time rule that decides nothing about a group, so it runs without the group lock. This is the one exception to ADR 0006 rule (d) for `group_events`, and it is written here so the reviewer can check it.
- The index on `occurred_at` (point 1) serves the removal and the read. If the table grows, a separate index on `occurred_at` alone can be added by a new migration. The per-write prune of an earlier draft is removed: one removal path, not two. A group without writes is cleaned up by the periodic job too, which closes the gap of the earlier draft.
- Startup of the job: with one calendar instance (ADR 0019, point 13) two jobs would not run at the same time. With more instances the delete is idempotent, so the overlap is harmless.

**8. Read endpoint.** `GET /api/groups/{groupId}/feed` (operation `listGroupFeed`), member only:
- Order of checks as in ADR 0001: session, group ID shape, membership (`group_not_found` for a non-member, also for a malformed ID).
- 200, an array of `FeedEvent`, newest first, at most 20. An empty array is valid, and the frontend shows the empty text.
- The read is outside the lock (ADR 0006 allows reads). If the name lookup fails, the response is 503 `service_unavailable`, never a feed without names (ADR 0003).
- `user.hasAvatar` follows the group rule of ADR 0018 (the `auth` flag AND a current member of this group).

Contract, `api/calendar/openapi.yaml`:
- `FeedEvent`: `id` (uuid), `kind` (enum `lobby_created`, `player_joined`, `player_left`, `lobby_full`), `lobbyStartsAt` (date-time, the line's time), `gameName`, `modeName`, `activityName` (nullable strings, `x-omitempty: false`), `user` (`UserRef`, nullable, null for `lobby_full`). `occurredAt` is not in the contract.
- Reuses `UserRef` with `hasAvatar` (ADR 0018).

Gateway: route `GET /api/groups/{groupId}/feed` to `calendar`, session required.

**9. Live.** A feed write is part of a lobby write, and that write sends the group signal (ADR 0019). The feed is refetched on that signal. The feed is not a signal source of its own, so there is one live mechanism.

**10. Lobby facts for the event (F-1).** `JoinState` in `domain/lobby.go` (the struct the join rules read) does not carry the lobby's game, mode and named activity names today. F-1 extends that struct, and the SQL that fills it in `infrastructure/postgres/lobbies.go` reads the three name columns of the lobby row in the same query. The create path already has them in `domain.Lobby`.

**11. Frontend.** A "Group feed" section in the group view (`/groups/{groupId}`), newest first, one text line per event, no links:
- Text from `kind`, the user's display name, the label (the shared label function of ADR 0017) and the local date and clock time of `lobbyStartsAt` (ADR 0013).
- `PersonAvatar` (ADR 0018) before the name.
- New entries (IDs not seen before a reload) are highlighted briefly. The duration is the UI expert's (ASSUMPTION).
- Empty text. All text in the i18n catalog. On a phone the lines wrap and do not scroll sideways (REQ-0012).

## Consequences
- A write does one insert per event under the lock it already holds. The cost is negligible.
- `LobbyTx` gains `AddFeedEvent`. `JoinState` gains three fields. The domain has the event rules, so their unit tests protect the requirement.
- The feed starts empty at release (DECISION).
- The table holds user IDs only, and the names are never stored.
- The removal job is the only writer that does not hold the group lock, which the reviewer checks against ADR 0006 rule (d).

## Delivery in small PRs
Build starts after ADR 0017 is finished (its PR6 merged). F-1 and L-1 (ADR 0019) both change `application/lobbies.go`, so they are merged one after the other.

| PR | Scope | Owner | Needs |
|---|---|---|---|
| F-1 | Migration `0008_group_events.sql` with up, down, the `GRANT USAGE ON SEQUENCE`, and an integration test that runs the inserts and reads as the runtime role `calendar`. Domain event rules, with unit tests for each row of point 2, including "Lobby full" with and without a limit and a denied join recording nothing. `JoinState` and its SQL extended for the lobby's three names (point 10). `LobbyTx.AddFeedEvent`, the writes in create, join and leave, with integration tests: a rolled-back write leaves no event; order on ties. The periodic removal job with a test at a fake clock: events older than 7 days are removed, newer ones kept, the job runs at start. No contract change and no read endpoint yet. | backend-expert | none (serial with L-1) |
| F-2 | `FeedEvent` and `GET /api/groups/{groupId}/feed` in `api/calendar/openapi.yaml`, generated code, read use case with `FeedLimit`, `FeedRetention` and the name lookup, `hasAvatar` by the group rule, gateway route. Tests: non-member 404, malformed ID 404, the limit of 20, the 7-day filter, lookup failure 503, names are the current names, a left member's line shows the name and initials. | backend-expert | F-1, A-2 (ADR 0018) |
| F-3 | Group feed section in the group view: text lines from the catalog, the shared label function, the time of `lobbyStartsAt`, `PersonAvatar`, empty text, phone layout. Tests: each kind renders its text, "Open" for a null game name, no link, empty state, the line shows the lobby start time. | ui-ux-expert | F-2, A-3 (ADR 0018) |
| F-4 | Highlight of new entries when a live reload brings them, using the ID diff of the reload. Tests with the fake live source: a new entry is highlighted, an unchanged feed is not re-rendered. | ui-ux-expert | F-3, L-4 (ADR 0019) |

## Not built now (YAGNI)
A lobby link in the event (product question below), history beyond 7 days (F-020), "load more", filters, reactions, read markers, a feed service, name snapshots, the per-write prune.

## Alternatives considered
- **Write the events in a second transaction after the change.** A failed event write would leave a change without its event, or the reverse. Rejected.
- **Database trigger.** The rules would live in SQL and in the domain (ADR 0006 keeps the rules in one place). Harder to test. Rejected.
- **Store names as a snapshot.** Copies names (ADR 0003) and needs a call to `auth` before the lock, so joins depend on `auth`. Rejected by the DECISION of the current name.
- **Store the composed label.** Puts the label rule in the backend, against ADR 0017 and the glossary. Rejected.
- **Foreign key from the event to the lobby.** A deleted lobby would block or cascade, and the events must stay (REQ-0018). The copies of ADR 0017 are the rule. Rejected.
- **Feed as its own service.** It has no capability of its own: events are facts of lobbies (CLAUDE.md, services). Rejected.
- **Prune per write and also periodically.** Two removal paths for one rule. Rejected for the periodic job alone.
- **Use the feed as the live signal.** Deletes and mode changes are not events, so the feed cannot carry every change. Rejected (ADR 0019).

## Open questions
- Product, for the user: a lobby link in the event. REQ-0018 leaves it open (an event is not a link, ASSUMPTION). The design has no lobby ID in the event, so a link would need one. Not decided here.
