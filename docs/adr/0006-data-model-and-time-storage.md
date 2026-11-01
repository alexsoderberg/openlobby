# 0006. Data model and time storage
Status: Accepted (2026-11-01)

## Context
CLAUDE.md requires one database or schema per service, and no provider names in the domain's data model. REQ-0003 requires that a lobby is shown in each member's local time and corresponds to the same real moment. The time zone assumption may change to a fixed time zone per group, so storage must not depend on that assumption.

After the user's decision the data model also needs roles (several admins, at least one as long as the group has members), several invite links per group and rules for leaving the group (REQ-0006). This requires atomic writes, because two members can do conflicting things at the same time (e.g. a join and the player leaving). Each lobby also has a max number of spots (F-018), and joining must be atomic against it: two members must not get the last spot.

## Decision

**Time:** all points in time are stored as `timestamptz` (exact moment, UTC internally). The API takes RFC 3339 with any offset and returns UTC with `Z` (ADR 0001). The frontend converts the user's local date and clock time to a moment before the call, and shows times in the browser's local time zone.

**Databases:** one PostgreSQL instance (see ADR 0008) with two databases, `auth` and `calendar`. Each service has its own runtime role and migration role (ADR 0012) with access only to its database. No foreign keys across database boundaries. References between services are uuids (`user_id`).

**Migrations:** each service owns its migrations in `services/<service>/migrations/`. Each migration has a `down` part (DoD). The migration tool is goose (ADR 0012).

**Data model `auth`:**
- `users`: `id uuid pk`, `provider text`, `provider_subject_id text`, `display_name text`, `created_at`, `updated_at`. Unique `(provider, provider_subject_id)`.
- `sessions`: `token_hash bytea pk`, `user_id uuid not null fk users`, `created_at timestamptz not null`, `expires_at timestamptz not null`. No `revoked_at`: logout deletes the row, and expired rows are deleted when a session is created (ADR 0005 review 5).
- `login_attempts`: `state_hash bytea pk`, `code_verifier text not null` (the PKCE verifier in plain text, because the provider needs it), `return_to text not null`, `expires_at timestamptz not null`. A row is deleted when the callback uses it, and expired rows are deleted when an attempt is created (ADR 0005 review 5).

**Data model `calendar`:**
- `groups`: `id uuid pk`, `name text` (`char_length` 1–50), `created_at`. No link or role column here.
- `group_members`: `group_id uuid fk groups on delete cascade`, `user_id uuid`, `role text not null` with check `role in ('admin', 'member')`, `joined_at timestamptz not null`, set at join. Primary key `(group_id, user_id)`. No index on `role`: several admins are allowed. That at least one admin exists is enforced by the application (see invariants). The membership is deleted when the member leaves, so rejoining gives a new `joined_at`.
- `invite_links`: `id uuid pk`, `group_id uuid fk groups on delete cascade`, `token text unique not null`, `created_by_user_id uuid not null`, `created_at`, `expires_at timestamptz not null` (= `created_at` + 2 hours, ADR 0007), `max_uses integer not null` with check `max_uses between 1 and 10` (mandatory, the limit per ADR 0007), `use_count integer not null default 0` with check `use_count >= 0 and use_count <= max_uses`. Index on `group_id`. Revoking is a delete. No `revoked_at`, because no history is required (REQ-0007).
- `lobbies`: `id uuid pk`, `group_id fk groups on delete cascade`, `created_by_user_id uuid`, `game_id uuid null`, `game_name text not null` (`char_length` 1–50), `max_players integer null`, `starts_at timestamptz`, `ends_at timestamptz`, `created_at`. Check `ends_at > starts_at and ends_at - starts_at < interval '24 hours'` and `max_players is null or max_players >= 1`. The interval is standard SQL. `game_name` is a copy of the game's name, with no foreign key to the game list. A game removed from the game list therefore leaves the lobby untouched (ADR 0010, REQ-0009). `game_id` is the id of the game the lobby was created from, null for a custom name, also without a foreign key; it is used only to order the game choice (amendment review 3). Index `lobbies_group_id_game_id_idx` on `(group_id, game_id)`.
- `lobby_players`: `lobby_id fk lobbies on delete cascade`, `user_id uuid`, `joined_at timestamptz not null`. Primary key `(lobby_id, user_id)`.
- `games` (game list, ADR 0010): `id uuid pk default gen_random_uuid()`, `name text not null` with check `name = btrim(name) and char_length(name) between 1 and 50` and unique index on `lower(name)`, `default_max_players integer null` with check `is null or >= 1`. No foreign key from or to other tables (`lobbies.game_id` is a plain value). The reserved name `Other` is checked in `application` only. Written by the `calendar` service via system admin endpoints (ADR 0010, 0011).

**Invariants enforced by the application** (the database cannot express them):
- Each invite link and each upcoming lobby has a creator who is a member. The leave rule (ADR 0004) ensures this: a member who has created upcoming lobbies cannot leave, and links created by the member are removed when they leave.
- Each group with members has at least one admin. If the last admin leaves, the transfer happens in the same transaction as the leave.
- A player row exists only for a member of the lobby's group.
- The number of players on a lobby is at most `max_players` when it is set. The check is made in the transaction after the group lock, see below. A trigger would count in the database, but then the rule would live in two places.
- The number of uses of an invite link is at most `max_uses`, which is always set. The check and increment are made in join, after the group lock (ADR 0007). The database check is a safety net, not the only check.

**Concurrency:** every write that touches a group (lobbies, players, memberships, links, roles) starts a transaction with `SELECT ... FROM groups WHERE id = $1 FOR UPDATE` as the first statement. The group is thus a serialization point. Join locks the group the link points to and checks the link again after the lock (ADR 0007). Without the lock a player row or link could be created for a member who is leaving at the same time. With 3–15 members per group the locking costs nothing in practice.
- Rules that read members or roles (admin check, choice of new admin, check of upcoming lobbies) run after the lock. Group writes use the default level READ COMMITTED, so that they see the values committed by a transaction that waited. Under REPEATABLE READ the read would see an old snapshot, and the rule would break.
- Two admins leaving at the same time: the second transaction waits for the lock and then sees that the first has already left. The last admin to leave transfers the role, and no transaction can leave the group without an admin. Without the lock both could leave at the same time and the group would be left without an admin.
- **Join against max:** the group lock is taken first, then players on the lobby are counted and compared with `max_players`. A concurrent join waits for the lock and sees the first transaction's committed row. Two members on the last spot: one succeeds, the other gets `lobby_full`. A row lock on the lobby (`FOR UPDATE` on `lobbies`) would give the same protection, but it would be a second lock point per write, and the group lock already exists. Tested with two concurrent calls against real PostgreSQL.
- **Join against max uses:** the same pattern. The group lock is taken first, the link is read again, `use_count < max_uses` is checked and `use_count` is incremented in the same transaction. No separate row lock on the link. Two concurrent joins on the last use: one succeeds, the other gets `invite_invalid`. Tested against real PostgreSQL.

**Revoked and left data:** when a member leaves, only players on upcoming lobbies and links are deleted. Past lobbies remain with `created_by_user_id` and are not shown to any member.

**Driver:** `database/sql` with a PostgreSQL driver (`pgx`) behind the repository adapters. The driver is used only in `infrastructure/postgres`.

## Consequences
- The time zone assumption affects only input and display. If the group instead gets a fixed time zone, the frontend changes, not the schema.
- `ends_at > starts_at` and the 24-hour length limit are checked both in the domain and in the database, so an invalid interval is impossible even with bugs.
- Role is a column with two values. Several admins require no migration. More roles require a changed check constraint.
- The lock per group makes writes in the same group serial. This is acceptable for MVP group sizes and should only change if measurement shows a problem.
- Group deletion when the last member leaves happens via cascade. No separate delete calls.
- Inactive invite links (expired or exhausted) are cleaned up in the same locked transaction when a new link is created (ADR 0007).
- Past lobbies with `created_by_user_id` for a departed member remain. No cleanup in MVP. See open questions in `docs/services.md`.
- No cross-service join. Display names are fetched from `auth` (ADR 0003).
- The game list (`games`) has no group relation and therefore takes no group lock. Duplicate names are prevented by the unique index, which gives `game_taken` (ADR 0010). The runtime role `calendar` gets DML on `games`. The operations role `calendar_ops` no longer exists (ADR 0010).
- The invite counter is incremented in the same transaction as the membership. If any step fails, both are rolled back, so the counter cannot end up wrong.
- No version is in production. The migrations of each service create the tables exactly as described here (in `calendar`, `games` and its seed rows come in their own migration, ADR 0010), so nothing is migrated from an earlier schema and no rows are filled in. Each `down` part drops what its `up` part created.

## Alternatives considered
- **Local time plus a time zone column per lobby:** two sources for one moment and a risk of errors around summer and winter time. An exact moment is simpler.
- **One schema per service in one database:** allowed by CLAUDE.md. Rejected in favor of separate roles and databases.
- **Shared database for all services:** breaks the rule "own data".
- **Snapshot of display names in `group_members`:** becomes stale after a name change. See ADR 0003.
- **`revoked_at` on invite links:** history that no requirement asks for (REQ-0007 excludes history).
- **Enum type for role:** `text` with a check is equally clear and easier to migrate.
- **Role in its own table:** one column is enough for two roles (YAGNI).
- **Partial unique index on admin per group:** replaced by the decision on several admins. It cannot express "at least one admin" anyway.
- **Optimistic locking (version column) instead of a lock per group:** more retries in the code for the same protection. A lock per group is simpler to review.
- **Row lock on `lobbies` for join:** same protection, but a second lock point. See Concurrency.
- **Trigger or constraint that counts players:** a count in the transaction under the lock is less code than a trigger and lies in the same place as the other rules.
- **Foreign key from `lobbies` to the game list:** removed games would either block the lobby or cascade it away, but REQ-0009 requires that the lobby remains.
- **Counter with conditional `UPDATE` on the link (row lock):** works, but gives a second lock point per join. The group lock already exists and gives the same protection.
- **Table `invite_uses` with one row per use:** history that no requirement asks for. A counter is enough (YAGNI).

Amendment 2026-11-01 (review 3). The `games` and `lobbies` definitions above include this change (rewritten in place in review 5). The reasons stay here.
- **`games`** (ADR 0010): `id uuid primary key default gen_random_uuid()` replaces `id text pk` (slug). `gen_random_uuid()` is built into PostgreSQL 13 and later and needs no extension, so PostgreSQL 13 or later is required (ADR 0008). The other columns and checks are unchanged. `name` must still be unique ignoring case, and the reserved name `Other` is checked in `application` only (ADR 0010).
- **`lobbies`** gets `game_id uuid null`: the id of the game in the list that the lobby was created from. It is null when the lobby has a custom name. The `game_name` copy is unchanged.
  - No foreign key to `games`, for the same reason as `game_name`: removing a game must not block or change a lobby (REQ-0009). Ids are random and never reused, so a removed game's id matches no game in the list. It is then only a dead value that is never shown.
  - The value is read in one place only: the order of the game choice for a group (ADR 0010, amendment review 3).
- **Index:** `create index lobbies_group_id_game_id_idx on lobbies (group_id, game_id);`. The count per game in a group is an index-only lookup on this index. `group_id` is the leading column, so the group's lobby queries also use it. On the Raspberry Pi the cost is one small index for a few thousand rows at most.
- **Alternatives considered (review 3):** a foreign key with `on delete set null` plus the copied name. It would also work, but it changes the lobby on game deletion (a write to lobbies by a game delete) and needs a test that the existing rule no longer holds. A dead id without foreign key gives the same result with less code.
- **Consequences:** `lobbies` rows created before this change have `game_id` null and do not count in the game choice. No production data exists, so no backfill is needed. The seed migration (ADR 0010) uses fixed ids, so the ids are the same in every environment.
