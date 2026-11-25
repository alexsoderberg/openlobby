# 0029. Goals and item drops: Blizzard item IDs in calendar, names and icons fetched and cached
Status: Accepted (2026-11-25)
Requirement: REQ-0030 (F-031, EXTEND, Decided 2026-11-25).
Amends: ADR 0017 section 6 (the game write and the game delete get one step each, section 3), ADR 0008 (the memory budget of `calendar` in its operations table, section 4).
Builds on: ADR 0017 (Named activities, game tree write), ADR 0018 (shared-group rule; Proposed, related only), ADR 0022 (standing per-person choice, no foreign key on a table the game write re-creates), ADR 0026 (images served behind the gateway, same origin, `img-src 'self'`; the basis of the no-hotlink rule), ADR 0002 (identity headers).
Introduces: one external dependency (the Blizzard Game Data API, with its OAuth client credentials), therefore this ADR. Adds one egress network to `calendar`. No new service, no asynchronous communication.

## Context
- REQ-0030 lets the system admin enter, per Named activity, a drop list of Blizzard item IDs. A person keeps goals (item IDs) per game. The lobby page shows, next to each player, the goals that are on the lobby's drop list.
- DECISION (user, 2026-11-24): the app stores only Blizzard item IDs and its own links. No name, icon or copy of an item is stored beyond a short cache. The Blizzard Game Data API is the source for names and icons.
- Blizzard's Developer API terms (research file, read 2026-11-24, page "Last updated October 1, 2019"; read through a fetch summary, not the raw page, so the quotes are checked against the page before the first deployment):
  - item 18 of section 2: "You must implement a maximum 30-day TTL (time-to-live) policy for all Data obtained through our APIs." and "This means You will retain data pulled from Blizzard Developer APIs for no longer than 30 days."
  - item 13: "You shall clearly and conspicuously identify Blizzard in Your Application as the source of the Data".
  - item 17: "You are limited to thirty-six thousand (36,000) calls to the Blizzard Developer API per hour".
  - No clause on icons or media. No per-second limit in the terms.
- Forever data (research, 2026-11-24): the Forever Journal is empty, so Blizzard gives no drop lists. Forever item endpoints returned 404 for about 43 percent of probed IDs on 2026-11-07. The Forever namespaces `static-forever-{region}` are undocumented; a build-stamped Forever namespace is unverified.
- Calendar has no egress network today (`infra/compose.yaml`, networks `services`, `data`, `edge-gateway`, `gateway-frontend`, all internal). Only `auth` has `auth-egress`, for Discord (ADR 0018).
- Calendar already owns the Named activities (`activities`, `game_modes`), the game tree write (`writeTree` in `services/calendar/internal/infrastructure/postgres/games.go`), the groups and their membership (`group_members`), and the lobby reads with players.

## Decision

### 1. The 30-day rule: allowed, with conditions
Answer: YES, storing item IDs is allowed under the terms. The design is built on the conditions below, and the reviewer checks them.

Reasoning:
- The terms restrict "Data obtained through our APIs", and the retention limit applies to data "pulled from Blizzard Developer APIs". What we pull from Blizzard is an item's name, its icon bytes and the answer "not found". These are kept at most 7 days (found) and 1 day (not found), and icon bytes at most 7 days, which is inside the 30-day limit.
- An item ID does not come from the API in this design. The system admin types the ID of a drop-list item from outside the app, and a goal copies an ID from our own drop list (a search only offers items of drop lists). The ID is a game object number, as it appears in game links and in fan sites, and the data about it that we own (which activity it drops in, and whom it is a goal for) is our own data.
- Keeping our own links to an ID is not keeping Blizzard's data, provided no Blizzard response field is stored.

Conditions (each one is a rule in section 3 or 4, and a test checks it):
- C1: the tables hold item IDs and our own links only. No column of `drop_items` or `goals` holds a name, icon, URL or response field from Blizzard.
- C2: the only Blizzard data kept is in the in-memory cache of section 4, with a TTL of at most 7 days, and entries are never written to PostgreSQL.
- C3: an item ID is stored only when typed by the system admin on a drop list, or copied from a drop list for a goal (validation, section 5).
- C4: the attribution "Data from Blizzard" is shown on every page where a name or an icon is shown (REQ-0030, section 6).

Residual risk, for the user to know: a strict reading could count an item ID that came from a search result as "Data". Our design avoids that because search results only offer IDs that are already on our drop lists. If the terms are revised (they date from 2019 and reserve the right to charge a fee), this decision is reviewed.

### 2. Placement: calendar, no new service
Drop lists, goals and the lobby reads all belong to `calendar`:
- a drop list is attached to a Named activity, which `calendar` owns (ADR 0017);
- a goal is a per-person choice for one game, the same pattern as preferred game roles, which `calendar` owns (ADR 0022);
- the lobby page joins goals with players and checks current group membership. In `calendar` this is one query on local tables. A separate service would need a call on every lobby read, and both services would depend on each other.

A new `items` service was rejected. It would own no data (the cache is in memory), would have no different pace of change, and would add a network hop to every lobby read. CLAUDE.md "start with few services" applies. The Blizzard adapter is an infrastructure adapter inside `calendar` (section 4). If the catalog later serves other services, it is split out with its own ADR.

`docs/services.md` is updated (calendar owns `goals` and `drop_items`, depends on the Blizzard Game Data API through the port `ItemCatalog`, realizes F-031).

### 3. Data model, migration and deletes
Migration `services/calendar/migrations/0013_goals_and_drop_items.sql` (goose; 0013 is the next free number after 0012):

```sql
-- +goose Up
CREATE TABLE drop_items (
    activity_id uuid    NOT NULL,
    item_id     integer NOT NULL CONSTRAINT drop_items_item_id_check CHECK (item_id >= 1),
    sort_order  integer NOT NULL,
    PRIMARY KEY (activity_id, item_id)
);
CREATE INDEX drop_items_item_id_idx ON drop_items (item_id);

CREATE TABLE goals (
    user_id uuid    NOT NULL,
    game_id uuid    NOT NULL REFERENCES games (id) ON DELETE CASCADE,
    item_id integer NOT NULL CONSTRAINT goals_item_id_check CHECK (item_id >= 1),
    PRIMARY KEY (user_id, game_id, item_id)
);

-- +goose Down
DROP TABLE goals;
DROP TABLE drop_items;
```

- `item_id` is `integer` (4 bytes, range up to 2^31 - 1). UNVERIFIED that Blizzard's item IDs stay below that; the research probed IDs up to 1515 only. If an ID above the range is ever needed, a migration widens the column. The CHECK keeps "a whole number of at least 1" in the database as well.
- `drop_items.activity_id` has no foreign key, on purpose. The game write deletes all modes with `deleteGameModesSQL`, and the cascade deletes all activities. A foreign key with `ON DELETE CASCADE` would delete every drop list on each admin save, the same trap as ADR 0022 section 2. Activities are re-inserted with their given IDs (ADR 0017), so the drop list survives a save.
- Orphan cleanup: `DELETE FROM drop_items d WHERE NOT EXISTS (SELECT 1 FROM activities a WHERE a.id = d.activity_id)` runs at the end of `writeTree` (after the inserts, so a re-inserted activity keeps its list) and in the game delete transaction (`deleteGameSQL`), after the cascade. It is one statement in the same transaction. A removed Named activity, a removed mode, and a removed game therefore take their drop lists with them, as REQ-0030 requires.
- `goals.game_id` has a foreign key with `ON DELETE CASCADE`. The game row is updated by `PUT /api/games/{gameId}` and only deleted by `DELETE`, so the cascade does not run on a normal save. A removed game takes its goals with it, and no lobby or page matches them (REQ-0030, ASSUMPTION of the product owner, confirmed).
- Goals are not deleted when their item leaves a drop list (REQ-0030). The item ID stays in `goals` as a plain number.
- `user_id` has no foreign key to `auth` (as `group_members`, ADR 0004). `auth` never deletes users in this version.
- Rollback: `down` drops both tables. Only goals and drop lists are lost; games, lobbies and groups are untouched. The runtime role gets DML through the default privileges (ADR 0012), no sequence is used.

### 4. Port, adapters, cache, configuration and egress
**Port** (consumer side, `services/calendar/internal/application/ports.go`). The port uses the project's own words and types and names no vendor:

```go
// ItemCatalog gives the English name and the icon of an item. Errors: ErrItemNotFound, ErrCatalogUnavailable.
type ItemCatalog interface {
    Item(ctx context.Context, itemID domain.ItemID) (domain.CatalogItem, error)
    ItemIcon(ctx context.Context, itemID domain.ItemID) (domain.ItemIcon, error)
}
```

`domain.CatalogItem{Name string}`, `domain.ItemIcon{MediaType string; Bytes []byte}`. `domain.ItemID` is an `int` with a constructor that rejects values below 1 (`invalid_item`). The application maps the two errors to the status of a reference: `found` gives `known`, `ErrItemNotFound` gives `unknown`, `ErrCatalogUnavailable` (and any other error from the catalog) gives `unavailable`. The application logs the other errors with the request ID.

**Adapters** (`services/calendar/internal/infrastructure/`):
1. `blizzard`: the adapter. Only this package imports Blizzard's host names and paths. It implements `ItemCatalog`:
   - OAuth2 client credentials: `POST https://oauth.battle.net/token` with `grant_type=client_credentials`, HTTP basic auth with the client ID and secret. The token is kept in memory until 60 seconds before its expiry. The standard library only (`net/http`, `encoding/json`, `net/url`), no OAuth library (one adapter, no new dependency; ADR 0012 pattern). UNVERIFIED: the token URL and the regional API host are taken from Blizzard's public OAuth documentation and are checked once by the backend on the first run.
   - Item name: `GET https://{region}.api.blizzard.com/data/wow/item/{itemId}?namespace={namespace}&locale=en_US`. `locale=en_US` is pinned, because item names stay English (REQ-0030 DECISION, 2026-11-25).
   - Icon: the item answer gives the media link; `GET .../data/wow/media/item/{itemId}?namespace=...` gives the asset URL; the adapter fetches the asset URL and accepts only `image/jpeg` or `image/png` by the bytes (`http.DetectContentType`), at most `maxItemIconBytes` (16 KiB, named constant in `domain`). The asset URL must have an allowlisted host (a constant in the adapter); any other host gives `ErrItemNotFound` for the icon and a logged warning.
   - Timeout per call: `catalogRequestTimeout` = 3 seconds. The HTTP client's `CheckRedirect` refuses any redirect to a host that is not on the allowlist (the three hosts of this section); Go follows redirects by default.
   - Rate limit: at most `maxCatalogCallsPerSecond` = 3 calls (token calls included), a stdlib ticker or a channel-based limiter. Three per second is 10,800 per hour, under a third of the 36,000 limit. Five per second was rejected: several forum users report 429 answers at about 5 per second (research, section 4), so the rate sits well below that.
   - 429 or 5xx: `ErrCatalogUnavailable`, and all calls pause for `catalogBackoff` = 60 seconds, logged once as a warning.
   - 404 for an item: `ErrItemNotFound`. Shortcut: Blizzard gives 404 both for an unknown item and for a namespace that no longer exists. After `maxConsecutiveNotFound` = 10 404 answers in a row with no 200 since the last 200, the adapter answers `ErrCatalogUnavailable` and logs a warning "namespace answers not found for every item, check BLIZZARD_NAMESPACE" on each such answer. A 200 resets the streak. While the guard is on, the adapter keeps making calls at the rate limit (so that a 200 can reset it) and answers unavailable for each. Upgrade to a real namespace probe if the warning is seen with a healthy namespace.
   - No log line contains a secret or a token.
2. `blizzardcache` (a decorator of `ItemCatalog`, same interface, in front of the adapter, wired in `main.go`): an in-memory map from item ID to the name result and the icon bytes, with the expiry of each entry.
   - found (name or icon): kept `catalogFoundTTL` = 7 days (under the 30-day limit, with margin for a slow restart).
   - not found: kept `catalogUnknownTTL` = 1 day, so that a page with many unknown items does not call Blizzard again on each view.
   - unavailable: not kept, so the next view tries again.
   - At most `catalogMaxEntries` = 512 entries, and icon bytes at most `maxItemIconBytes` = 16 KiB each. Worst case about 8.5 MiB, the budget for the item cache in ADR 0008's operations table (amended by this ADR, section 4). The entries are the items of drop lists and goals, which the database bounds; when the map is full, a new entry is not kept (the call is still answered), and an expired entry is removed first.
   - Shortcut (DECISION user, 2026-11-25: accepted): an in-memory cache is empty after a container restart. The first views after a restart may show "Name not available" for items that Blizzard did not answer within the request budget (section 5, `itemNameBudget`). The next view fills the cache. Acceptable: restarts are rare, and the terms allow a cache of this length; upgrade to a PostgreSQL cache table with `fetched_at` only if the restarts or the first views are seen to be a problem. A PostgreSQL cache would also be Blizzard data in the database, which is more than C1 and C2 allow today.
3. `postgres` (existing): the repository methods for `drop_items` and `goals` (section 3). They hold no Blizzard data.

**Configuration** (environment variables of `calendar`; `infra/.env` and `.env.example` carry the values, never the repository):
- `BLIZZARD_CLIENT_ID`, `BLIZZARD_CLIENT_SECRET`: secrets. From the Battle.net developer portal, one pair for the application (Blizzard staff: one pair per application, 36k limit each). Required in production.
- `BLIZZARD_REGION`: one of `us`, `eu`, `kr`, `tw`. DECISION (user, 2026-11-25): `eu`. The Forever namespaces exist for all four regions (research); a change is a configuration change.
- `BLIZZARD_NAMESPACE`: the namespace string, set in `infra/compose.yaml` as `static-forever-${BLIZZARD_REGION}` (the alias that tracks the latest build).
- Startup: if one of the two client variables is set and the other is not, `calendar` fails to start (fail fast). If both are empty, the catalog is `unavailable` for all items, and `calendar` logs one warning at startup ("item catalog disabled"). This keeps `docker compose up calendar` working for a developer without credentials.

**Pinning (deviation, DECISION user, 2026-11-25: accepted):** REQ-0030 asks for a pinned version where Blizzard offers one, with a fallback and a warning. Blizzard offers no verified build-stamped Forever namespace (research, section 5: unverified; one Blizzard staff post of 2023 says the older Classic 3.4.2 namespaces appeared removed after a patch, and nothing shows this for Forever). So the first delivery pins the namespace as configuration (`BLIZZARD_NAMESPACE`, one value, logged by the startup line), and uses the alias. The fallback that REQ-0030 asks for is the streak guard above (a warning and "Name not available", never "Unknown item" for every item). When a build-stamped Forever namespace is verified with one GET, an amendment of this ADR adds the pin and a fallback to the alias.

**Egress.** `calendar` joins a new network `calendar-egress` (not internal), attached to `calendar` only, as `auth-egress` is for `auth` (ADR 0018). The hosts reached from it: `oauth.battle.net`, `{region}.api.blizzard.com`, and the asset host of the icon (allowlisted in the adapter; the host name is UNVERIFIED for Forever and is confirmed by the backend on the first icon fetch). Compose cannot allow hosts by name, so the allowlist of section 4 is the control in the code. No inbound port is published.

**Icons: calendar serves them, the browser does not call Blizzard.** Calendar proxies the icon through its own route `GET /api/items/{itemId}/icon` (section 5). Reasons:
- Privacy: a hotlink sends each viewer's IP address to Blizzard's CDN, the reason ADR 0026 keeps all images on our origin (ADR 0018, Proposed, applies the same reasoning to avatars).
- Content security: the page loads images from its own origin only (`img-src 'self'`, the rule of ADR 0026). A hotlink would need a CSP host entry and a Blizzard host in the frontend.
- Terms: the cache is ours and has our TTL. A hotlinked URL would keep the image in the browser cache with no control by us, and the terms are silent on media (UNVERIFIED stance, research section 4).
- Cost: one icon is a few kilobytes, at most 16 KiB, held in the cache. The route is limited to items that are on a drop list or in a goal (section 5), so it cannot be used to fetch arbitrary items.

**Failure behaviour (REQ-0030):** `ErrCatalogUnavailable` and timeouts give `unavailable` (the text "Item", the ID and "Name not available", no icon). `ErrItemNotFound` gives `unknown` (the text "Unknown item" and the ID, no icon). The page works in both cases; no error page.

### 5. API contract (`api/calendar/openapi.yaml`)
Conventions as in ADR 0017 and 0022: the rules of each operation are listed in its description in the order they are checked (identity, shape, membership, permission, validation, existence, state). An invalid UUID in a game path gives `game_not_found` (404), as the game endpoints do today. Item IDs are validated in the domain.

New schemas:
- `Item`: `itemId` (integer, at least 1), `name` (string or `null`; the English name when `status` is `known`), `status` (`known`, `unknown` or `unavailable`).
- `GameItem`: `Item` plus `dropsIn`: array of `{activityId, activityName, modeName}`, the Named activities of this game whose drop list has the item, in game order.
- `GameGoals`: `gameId`, `gameName`, `gameLogoVersion` (as `Game`, ADR 0026), `goals`: array of `GameItem`, ordered by `itemId`.

New operations (each has a short description in the contract):

| Operation | Method and path | Who | Answers |
|---|---|---|---|
| `listGameItems` | `GET /api/games/{gameId}/items?activityId=&q=` | any signed-in person | 200 `{items: GameItem[], nameSearchComplete: boolean}`. 404 `game_not_found`. 400 `invalid_activity` when `activityId` is given and is not an activity of the game (`invalid_request` when not a UUID). |
| `addDropItem` | `PUT /api/games/{gameId}/activities/{activityId}/items/{itemId}` | system admin | 201 `Item` (the name status is resolved at once, so "Unknown item" shows at once). 400 `invalid_item`, 400 `invalid_activity`, 403 `not_allowed`, 404 `game_not_found`, 409 `drop_item_taken` (already on this drop list, nothing changed). |
| `removeDropItem` | `DELETE /api/games/{gameId}/activities/{activityId}/items/{itemId}` | system admin | 204 (idempotent once the checks pass). 400 `invalid_item`, 400 `invalid_activity`, 403 `not_allowed`, 404 `game_not_found`. The client asks for confirmation first (ConfirmDialog). |
| `getGoals` | `GET /api/users/me/goals` | any signed-in person, no membership | 200 `{games: GameGoals[]}`: the games with at least one goal or at least one drop-list item, sorted as `GET /api/games` (name ignoring case, then `id`). |
| `addGoal` | `PUT /api/users/me/games/{gameId}/goals/{itemId}` | any signed-in person | 204. Idempotent: an existing goal gives 204 and no second row. 400 `invalid_item` (not a whole number of at least 1, or not on a drop list of the game), 404 `game_not_found`. |
| `removeGoal` | `DELETE /api/users/me/games/{gameId}/goals/{itemId}` | any signed-in person | 204, idempotent. 400 `invalid_item` (not a whole number of at least 1). 404 `game_not_found`. No drop-list check: a goal whose item left the drop list can be removed. |
| `getItemIcon` | `GET /api/items/{itemId}/icon` | any signed-in person | 200 with `Content-Type` `image/jpeg` or `image/png` and `Cache-Control: private, max-age=3600`. 400 `invalid_item`. 404 `item_not_found` when the item is on no drop list and in no goal, Blizzard does not know it or has no icon. The route answers for a goal's item after its item left every drop list (REQ-0030). 503 `service_unavailable` when the catalog is unavailable. |

Changed schemas:
- `LobbyPlayer` gets `goals`: array of `Item`, always sent, `[]` when none. It holds the player's goals that are on the drop list of the lobby's Named activity (`lobbies.activity_id`) and whose `game_id` is the lobby's game (`lobbies.game_id`), so goals of two games never mix (REQ-0030), only when the lobby has a game and an activity, and only when the player is a current member of the lobby's group (a former member's goals are not shown, ADR 0022 reason). The list is `GET /api/groups/{groupId}/lobbies/{lobbyId}` only, not the lobby list. A goal's name status is resolved in the same request, within the budget below.
- `Game` (admin form) is unchanged. Drop lists are not part of the game tree, so the game write, the game read and the member game list do not resolve item names. This keeps the game tree and its write as they are (ADR 0017).

Error codes (new): `invalid_item` (400), `drop_item_taken` (409), `item_not_found` (404). Existing codes reused: `invalid_activity`, `game_not_found`, `not_allowed`, `invalid_request`, `service_unavailable`.

Name resolution budget: a request that needs names (`listGameItems`, `addDropItem`, `getGoals`, the lobby read) waits at most `itemNameBudget` = 3 seconds in total for Blizzard answers. Items not answered in that time are `unavailable` for this request. `nameSearchComplete` is `false` when any item of the answer is `unavailable`. `getGoals` gives `unavailable` names in the same way.

Search rule (`listGameItems`, `q`): items whose `status` is `known` are kept only when their name contains `q`, ignoring case. Items that are `unknown` or `unavailable` cannot be matched by name, so they are always kept (REQ-0030: "the items are still listed by their ID"). `q` is trimmed, at most 50 characters, and empty means no filter.

Ordering: `listGameItems` lists each activity's items in the order of `drop_items.sort_order` (then `itemId`), with activities in the game's order (mode order, then activity order, as in the game read). With `activityId`, only that activity's list.

Writes to drop lists: `sort_order` for a new entry is one more than the highest of its activity, computed in the same statement. Two concurrent adds of the same item: the primary key gives `drop_item_taken` to the second.

Validation of goals: `addGoal` checks that the item is on a drop list of an activity of the game (one query, the `drop_items` join on `activities` and `game_modes` with `game_id`). Only a goal can therefore be made for an item that the system admin entered. A goal is for one game; if the item is in the drop lists of two games, the goal is for the game in the path.

### 6. Frontend (owned by the UI/UX expert, `frontend/`)
The rules below are the contract for the UI/UX expert; the design of the screens is theirs.
- **You page:** a section "Goals" between "Game roles" and "System admin" (REQ-0020). It lists `GET /api/users/me/goals`, one block per game: the game name with its logo (`GameLogo`, ADR 0026), then one row per goal: `ItemIcon` (only when `status` is `known` and the icon loads; otherwise no icon), the name, or "Item" with the ID and "Name not available", or "Unknown item" with the ID; then the Named activities (dungeons or raids) of `dropsIn` as text; and a remove button (IconButton, label "Remove goal"), with no confirmation, a toast on success (REQ-0022). The "Add goal" control opens a panel (the Create frame, ADR 0023, or the frontend's existing panel pattern, the UI/UX expert decides) with a search field, a Dropdown list (`Select`, ADR 0027) "All dungeons and raids" or one dungeon or raid, and the results from `listGameItems`. Each result has "Add goal", or "Already in your goals" (the item ID is in the list the page holds; the server stays idempotent). When `nameSearchComplete` is false, the panel says that names are not available, so the name search cannot match them.
- **Attribution:** the text "Data from Blizzard" (one string, in `frontend/src/i18n` texts, ADR 0013) is shown once on each page where a name or an icon is shown: the You page, the lobby page and the game form. One component renders it, and each page renders that component once.
- **Lobby page:** under each player (in the player list, REQ-0021 layout), its `goals` as icon, name, or fallback text (the same rules as above). No goal list when `goals` is empty. The attribution once on the page.
- **Game form (system admin, REQ-0010), under each Named activity:** a "Drop list" block: the items in order with their name or fallback, a field for the item ID (a whole number of at least 1; the browser's number input is not enough, the server answers `invalid_item`), add on submit, and remove with ConfirmDialog (Keep gets focus first). Drop-list writes take effect at once, not with the Save of the game form, because they have their own endpoints. A new activity has no ID until the game is saved, so its drop list appears after the first save. The form says this in one line.
- Toasts (REQ-0022): adding and removing a goal are two more places of its rule. Admin drop-list changes show an inline status, as the other admin writes do (ASSUMPTION: REQ-0030 does not list them as toast places).
- Icon URL: `itemIconUrl(itemId)` returns `/api/items/${itemId}/icon`, next to the other URL helpers in `frontend/src/api/`, so the path exists in one place (ADR 0026 rule).

### 7. Gateway
`services/gateway` adds the routes of section 5 to its route table with method and path, and `routes_contract_test.go` checks them against `api/calendar/openapi.yaml`. The gateway removes the client's `X-User-*` as before. No body limit change: the bodies are empty or small, and the 16 KiB limit (ADR 0001) applies.

### 8. Security and privacy
- No secret in the repository. `BLIZZARD_CLIENT_SECRET` only in `infra/.env` or a secret store.
- Blizzard's data is only read on the server; the browser receives names as JSON from our API and icons from our route.
- Every write is checked in `application`: the system admin check for drop lists (`X-User-System-Admin`), and for goals the caller is always the owner (`X-User-Id`, never a user ID from the path). The lobby read checks group membership (`group_not_found`, as today).
- Goals of other people are shown only on the lobby page, to members of the lobby's group, and never on the You page (REQ-0030).
- Item IDs in the routes are validated before any call to Blizzard. The icon route calls Blizzard only for items on a drop list or in a goal, so a signed-in person cannot make calendar fetch arbitrary IDs.

### 9. PR split and owners
Each PR is shippable on its own, and each one states the rule it relies on. The order is fixed by the arrows.

| PR | Scope | Owner (model) | Needs |
|---|---|---|---|
| PR1 | Infrastructure: network `calendar-egress` on `calendar` only, env `BLIZZARD_CLIENT_ID`, `BLIZZARD_CLIENT_SECRET`, `BLIZZARD_REGION`, `BLIZZARD_NAMESPACE` in `infra/compose.yaml` and `infra/.env.example` (no values). The build passes and `calendar` starts with empty values (warning, section 4). | devops-expert (haiku, step 1) | none |
| PR2 | Backend: migration 0013 (both tables), `domain.ItemID` and `domain.CatalogItem`, the port `ItemCatalog`, the adapter `blizzard`, the decorator `blizzardcache`, wiring in `main.go`, the drop-list endpoints (`listGameItems`, `addDropItem`, `removeDropItem`), the icon route `getItemIcon`, the gateway routes of these, the contract changes of these. Tests: domain rules, the adapter against `httptest` (no real call), the cache TTLs, the streak guard, the cleanup statement in a DB integration test, the route contract test; the icon route for an item that is only in a goal. | backend-expert (opus, step 3) | PR1 for the configuration to run; not for the tests |
| PR3 | Backend: `getGoals`, `addGoal`, `removeGoal`, the `goals` field of `LobbyPlayer`, the gateway routes of these, the contract. Tests: idempotency, validation against the drop lists, the membership rule of the lobby read, the goals of a removed game gone (cascade test); goals of another game with the same item are not shown on a lobby of this game (`game_id` match test). | backend-expert (opus, step 3) | PR2 |
| PR4 | Frontend: the drop-list block in the game form under each Named activity, `itemIconUrl`, the shared attribution component "Data from Blizzard", the item-ID field, ConfirmDialog for removal. | ui-ux-expert (opus, step 3) | PR2 |
| PR5 | Frontend: the Goals section of the You page (list, search, add, remove, toasts), the goals of each player on the lobby page, the attribution once per page. | ui-ux-expert (opus, step 3) | PR3, PR4 |

The architect's part (this ADR, the glossary in `CLAUDE.md`, `docs/services.md`) is a docs-only change, reviewed by the reviewer with no `BLOCKER` required (CLAUDE.md, workflow step 5). The product owner updates F-031 and the backlog status after PR5.

## Consequences
- Calendar has one more network (`calendar-egress`) and an outbound path to Blizzard. The egress is a new external dependency, and its monitoring (rate, 429 and warnings) is devops' work in the existing logs.
- The item catalog gives calls at most 3 per second (a cold icon costs three calls). The first view of a large drop list after a restart can show "Name not available" for some items (cache shortcut). Forever's 404 rate (about 43 percent on 2026-11-07) means many real items will show "Unknown item" until Blizzard fills the data. The UI copy says what "Unknown item" means and the admin can save the ID anyway (REQ-0030).
- The data model is two tables and one cleanup statement; no table holds Blizzard data.
- A later Journal-based drop list (REQ-0030, "later") replaces the hand-entered rows of `drop_items`, not the goals.
- The migration is reversible (section 3).

## Alternatives considered
- **A new `items` service.** Rejected (section 2): no data of its own, an extra hop on every lobby read, and no reason to deploy separately.
- **A PostgreSQL item table with names and icons, refreshed every 30 days.** Rejected: it stores Blizzard data for the whole catalogue, needs a refresh job, and goes against REQ-0030 ("no item database of our own", DECISION 2026-11-24). The in-memory cache gives the same user-facing result with a shorter life.
- **Hotlinking Blizzard's render URL in the browser.** Rejected (section 4): privacy, a CSP host entry, and no cache control by us.
- **Drop lists inside the game tree (`PUT /api/games/{gameId}`).** Rejected: the tree write would have to insert items, the name lookups would run on every game read, and the write would be replaced on each admin save. Separate endpoints keep the write immediate, as REQ-0030 asks for the confirmation of a removal.
- **A foreign key from `drop_items` to `activities` with cascade.** Rejected (section 3): the game write deletes and re-inserts activities, so the cascade would delete all drop lists on each save.
- **An OAuth library.** Rejected: the client credentials flow is one POST, and the standard library is enough (no new dependency).
- **Blizzard's Forever Journal for the drop lists.** Not possible yet: the journal is empty (REQ-0030, DECISION 2026-11-25). It remains the later source.

## Open points (not blocking)
- Pinned build namespace: to be verified with one GET (section 4); the amendment follows then. Until then the streak guard and the alias apply.
- Terms: the terms page is from 2019; the 30-day decision is reviewed when Blizzard revises it.
