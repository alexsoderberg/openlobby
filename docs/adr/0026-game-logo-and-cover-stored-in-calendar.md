# 0026. Game logo and game cover: stored in calendar, uploaded per image, served behind the gateway
Status: Accepted (2026-11-15)
Requirement: REQ-0026 (F-030).
Amends: ADR 0001 (the 16 KiB body rule gets one exception, the game image upload, which reads at most 524288 bytes; the constant `httpapi.MaxBodyBytes` in `pkg/httpapi/httpapi.go` line 16 stays 16 KiB; the exemption is in the calendar transport, `services/calendar/internal/transport/router.go` line 32, and the info text of `api/calendar/openapi.yaml` line 17 names it). ADR 0016 section 7 (`GenreFrame`: on the Next up card a game cover replaces the genre background pattern; the genre accent border and the genre icon stay). ADR 0010 and ADR 0017 get two more optional game fields and two more lobby fields, with no change to their rules.

## Context
- The game list belongs to `calendar` (ADR 0010) and is managed by the system admin (ADR 0011). A game's images belong to the game, so they belong to `calendar`.
- The Pi runs Docker Compose with PostgreSQL (ADR 0008). There is no object storage and no volume for files. Containers stay stateless, so the only store is PostgreSQL.
- ADR 0018 stores avatars as bytes in a table, checks the PNG signature, and serves them through a gateway route with a session check. ADR 0018 is Proposed and not built. Its choice of revalidation with an ETag and no version in the URL does not fit here: an admin replaces a logo on a page that stays open. A React `<img>` whose `src` does not change keeps the old bitmap until reload, so the URL must change with the content. Game images therefore carry a version in the URL.
- Body limits today: `calendar` wraps every contract operation in `httpapi.LimitBody` (16 KiB, `services/calendar/internal/transport/router.go`). The edge has `client_max_body_size 1m` (`infra/edge/nginx.conf`, ADR 0009). The gateway has no body limit and forwards bodies and response headers unchanged.
- The gateway route table lists method and path exactly, and `routes_contract_test.go` checks it against `api/calendar/openapi.yaml`.
- ADR 0017: new response fields are optional in the schema and always sent. ADR 0016: a lobby reads its game's data through a join on `games`, with no copy.
- No new external dependency, no new service, no asynchronous communication. A new image library is not needed (see point 6).

## Decision

### 1. Each image is uploaded and removed by its own request
DECISION (user, 2026-11-15): the upload happens immediately when the admin chooses the file, as its own request. The admin chooses a file in the game form. The file is sent at once as its own `PUT`, and removal is its own `DELETE`. Saving the game (`PUT /api/games/{gameId}`) does not carry images and does not change them.

Why not in the game save:
- Sending the image with the game save means base64 in the JSON (a third larger), a body limit of about 1.5 MB for every game write, a change to the edge limit, and a three-state field (omitted, `null`, value). Generated Go code expresses that poorly, and ADR 0017 rejected the same shape for PATCH. A multipart game save is a new encoding for the same route.
- A new game has no ID until it is saved, so in both designs the images come after the first save.

Consequence: REQ-0026's "when I save the game" becomes "when I choose the file". The rule "a denied upload changes nothing" stays. The product owner amends REQ-0026. If the user wants the images to save with the game, that is a separate ADR with the base64 design above.

### 2. Storage: one table in the `calendar` database
Migration `services/calendar/migrations/0010_game_images.sql` (goose; number 0010 today, because ADR 0024 reserves 0009 for role icons; if ADR 0024 merges first the number after its migration is used, and the file is numbered at merge time as the next free number):

```sql
-- +goose Up
CREATE TABLE game_images (
    game_id    uuid NOT NULL REFERENCES games (id) ON DELETE CASCADE,
    kind       text NOT NULL CONSTRAINT game_images_kind_check CHECK (kind IN ('logo', 'cover')),
    media_type text NOT NULL CONSTRAINT game_images_media_type_check CHECK (media_type IN ('image/png', 'image/jpeg', 'image/webp')),
    version    text NOT NULL CONSTRAINT game_images_version_check CHECK (version ~ '^[0-9a-f]{64}$'),
    image      bytea NOT NULL CONSTRAINT game_images_size_check CHECK (octet_length(image) BETWEEN 1 AND 524288),
    PRIMARY KEY (game_id, kind)
);

-- +goose Down
DROP TABLE game_images;
```

- Both kinds are in the CHECK from PR1, so the data model is written once and PR2 needs no migration.
- `REFERENCES games ... ON DELETE CASCADE`: a removed game takes its images with it (REQ-0026). Lobbies still have no foreign key to `games` (ADR 0010), so their names stay. `game_modes` already has such a foreign key (ADR 0017).
- The limit 524288 is 512 KiB, the same named constant as in the domain (`domain.MaxGameImageBytes`). The `version` is the hex SHA-256 of the bytes, written at save time.
- The runtime role `calendar` gets DML through the default privileges (ADR 0012). No sequence is used.
- Rollback: `down` drops the table. Only uploaded images are lost. Games, lobbies, names and players are untouched. Without images, the frontend shows the monogram and the genre theme (REQ-0026).

Why a table and not a storage port with a file or object adapter: there is no object storage, and a file adapter would need a volume, which breaks the stateless containers. The database is the only store that exists. The table is behind a repository port in `application` (point 4), so a later file or object store is an adapter change only. Size: 512 KiB per image, a few dozen games, at most about 50 MB in total. PostgreSQL stores such values out of line (TOAST) and reads them by primary key.

### 3. Upload and removal contract (`api/calendar/openapi.yaml`)
One path with `kind` for logo and cover, so that one handler and one rule set serve both (DRY). Schema `GameImageKind`: `enum: [logo]` in PR1, `enum: [logo, cover]` in PR2 (an additive change).

| Operation | Method and path | Body and answers |
|---|---|---|
| `setGameImage` | `PUT /api/games/{gameId}/images/{kind}` | Body: the raw image, with `Content-Type` `image/png`, `image/jpeg` or `image/webp` (`format: binary`), at most 524288 bytes. The request's `Content-Type` is documentation only; the server decides the type from the bytes. Answers 200 `Game` (the game as it is after the write, with its versions), like the other writes that return the changed object (ADR 0017 amendment 2026-11-09). |
| `removeGameImage` | `DELETE /api/games/{gameId}/images/{kind}` | 204. Idempotent: no image is also 204. |
| `getGameImage` | `GET /api/games/{gameId}/images/{kind}?v={version}` | 200 with the stored bytes and the stored `Content-Type` (see point 4). |

Order of checks, in the same style as the game list (ADR 0001, ADR 0010):
- `PUT`: session (401), then the path form (`gameId` not a uuid: 404 `game_not_found`; unknown `kind`: 404 `game_image_not_found`), then the transport reads at most 524289 bytes (see point 9), then permission (403 `not_allowed`, before any check of the image), then the size (413 `image_too_large` when the body has more than 524288 bytes), then the type (400 `invalid_image_type`, by the bytes, point 6), then `game_not_found` (404), then the write.
- `DELETE`: session, path form, permission (403), `game_not_found` (404) when the game is missing, then 204.
- `GET`: session, path form, then 404 `game_image_not_found` when `kind` is unknown, when there is no image, when `v` is missing or is not the current version of this image, or when the game is missing.

Permission is checked in `application` against `Actor.IsSystemAdmin` (ADR 0011). The gateway and the UI are not the protection.

Errors (new codes, in the enum of `api/calendar/openapi.yaml` in PR1):
- `invalid_image_type` (400): the bytes are not PNG, JPEG or WebP, including an empty body.
- `image_too_large` (413): more than 524288 bytes.
- `game_image_not_found` (404): see the `GET` rules above.

The contract's `required` and `nullable` rules for new response fields follow ADR 0017, section 12 (applied in point 5 of this ADR).

### 4. Delivery: the URL carries the version
`GET /api/games/{gameId}/images/{kind}?v={version}` is a session route through the gateway, so the browser's requests are checked like every other API request.
- Access: any logged-in user, not only members of a group. REQ-0026 says game images are shown to all logged-in users, and the game ID is a random uuid. A logged-in non-member who knows a game ID can fetch its image, which reveals nothing about any group. DECISION (user, 2026-11-15): open to any logged-in user.
- Response headers: `Content-Type` = the stored `media_type`; `Cache-Control: private, max-age=31536000, immutable`; `X-Content-Type-Options: nosniff`. A 404 carries no caching header.
- Why `immutable` is safe: the URL names the content. A new upload has a new version, so a new URL. `v` must equal the current version of the image: a request for an older version gets 404 and never the newer bytes under the old URL. Without this rule a cache could keep new bytes under an old key, and a revert (A to B to A) would show B under A.
- The browser keeps the image for a year. Logout does not clear it. The bytes are public game art and not personal, so this is accepted.
- No `ETag`. The version is the validator. An image costs one primary key read, and only on a cache miss.

Why a version and not `hasLogo` (as `hasAvatar`, ADR 0018): `hasLogo` names the same URL after a replacement, so an open page keeps the old bitmap. The version costs one string per game and per lobby.

### 5. The schemas tell the frontend which image exists
- `Game` (`GET /api/games`, `POST` and `PUT /api/games/{gameId}`, `GET /api/groups/{groupId}/games`) gets `logoVersion` in PR1 and `coverVersion` in PR2. Type: string, nullable, pattern `^[0-9a-f]{64}$`. `null` means no image of this kind.
- `Lobby` (and `LobbyDetail` through `allOf`) gets `gameLogoVersion` in PR1 and `gameCoverVersion` in PR2. `null` for: no game (open lobby), a custom name ("Other"), a game without this image, or a removed game.
- None of the four is in `required`. The server always sends them, so their descriptions say so (ADR 0017, section 12). Existing fixtures stay valid.
- Every operation that answers a `Lobby` or `LobbyDetail` sends the lobby fields. There are seven: `listUpcomingLobbies`, `createLobby`, `getLobby` (`LobbyDetail`), `setLobbyGame`, `setLobbyMode`, `setLobbyActivity` and `clearLobbyActivity` (the last four as ADR 0017, amendment 2026-11-09 defines them).
- The contract carries no URL. The frontend builds the URL from `gameId`, the kind and the version, in one function (point 8). `Lobby.gameId` already exists (ADR 0017).
- Backend: the game reads (list, group list, one game, and the `GameCatalog` snapshot that create uses for its response, ADR 0016 section 6) and the lobby responses of the seven operations listed in point 5 join `game_images` on `(game_id, kind)` with a `LEFT JOIN`, one per kind. Byte columns are never selected in a list read; only `Image` reads `image`.

### 6. Image rules (domain, `services/calendar/internal/domain`)
Pure functions with unit tests. No `net/http` in the domain.
- `MaxGameImageBytes = 512 << 10`. The only place of the limit; the migration CHECK mirrors it.
- `SniffGameImage(data []byte) (mediaType string, ok bool)`, by the first bytes:
  - PNG: `89 50 4E 47 0D 0A 1A 0A` at offset 0 gives `image/png`.
  - JPEG: `FF D8 FF` at offset 0 gives `image/jpeg`.
  - WebP: `RIFF` at offset 0 and `WEBP` at offset 8 give `image/webp`.
  - Anything else, including GIF, SVG, HTML and text, is refused. An SVG is never stored, because it can carry script.
- The request's `Content-Type` is ignored for the decision. A file named `.png` that holds text is refused.
- `GameImageVersion(data []byte) string`: the lowercase hex SHA-256 of the bytes.
- The size is checked before the type, so a large file of any kind gets `image_too_large`.
- No decoding, no re-encoding, no resizing and no dimension check. The admin is trusted, the bytes are served as they are, and the browser scales them. Not built now: a dimension check (point 11).

### 7. Application and ports (`services/calendar/internal/application`)
- Use case `GameImages` with `Set(ctx, actor, gameID, kind, data) (Game, error)`, `Remove(ctx, actor, gameID, kind) error`, `Image(ctx, gameID, kind, version) (GameImage, error)`.
- Port `GameImageRepository`, defined in `application`, implemented by the PostgreSQL adapter: `Save(ctx, gameID, GameImage) error`, `Delete(ctx, gameID, kind) error`, `Find(ctx, gameID, kind) (GameImage, bool, error)`.
  - `Save` on a missing game fails with the foreign key `game_images_game_id_fkey`, which the adapter translates to `game_not_found` by constraint name (ADR 0017, section 5).
  - `Delete` answers `game_not_found` when the game is missing, and otherwise succeeds whether or not a row was there.
- `Set` and `Remove` log the change at info level with `actorUserId`, `gameId` and `kind` (ADR 0010). Never the bytes.
- Errors in `domain`: `ErrImageTooLarge`, `ErrImageType`, `ErrGameImageNotFound`. The existing `ErrNotAllowed` (domain, `domain.go`) and `ErrGameNotFound` (application, `games.go`) are reused.
- The `GameCatalog` reads (point 5) give the versions. No new port for them.

### 8. Frontend (`frontend/src`)
- One function `gameImageUrl(gameId, kind, version)` returns `/api/games/${gameId}/images/${kind}?v=${version}`. It lives in `frontend/src/api/` next to the client, so the path exists in one place (the same rule as ADR 0018 for avatars). The URL is same-origin, so `img-src 'self'` works.
- `GameLogo` in `frontend/src/ui/`, next to the existing `Avatar` (ADR 0018 names `PersonAvatar` for the same place; it is not built yet). Props: `gameId`, `name`, `version`.
  - With a version: `<img alt="" src={gameImageUrl(...)}>`, in a fixed box, `object-fit: contain`.
  - Without a version, or when the image fails (`onError` on `<img>`, not a `catch`): the monogram. The monogram reuses the existing `Avatar` with the initials of the game name (group icons already do that). No second initials component.
  - The name is always shown as text next to the logo by the caller. The logo is a sibling before the label, never part of the label string (the label stays text-only, REQ-0026).
- Places in PR1: the game form (`features/games`), the game list (the admin page), the Next up card and the lobby page. Not on the landing page, the group list, the lobby list or the week blocks (REQ-0026).
- Game form: a `GameImageField` for one kind (PR1: logo; PR2: cover, the same component with another `kind`). It shows the current image or the monogram, a file input with `accept="image/png,image/jpeg,image/webp"`, and "Remove image" (`Button` variant `danger`, visible text, ADR 0023). The upload starts when the file is chosen. Errors are shown from the code (`invalid_image_type`, `image_too_large`, `not_allowed`, `game_not_found`), with messages in the catalog (ADR 0013). A successful upload or removal shows an inline status, not a toast, because REQ-0022 lists the places where toasts appear and this is not one of them.
- The form's image field is shown after the game has an ID. A new game gets its images after its first save, and the form stays in edit mode after the create.
- No client-side size check. The limit lives only in the domain, and the server's error is shown. The frontend does not repeat the number.
- The generated TypeScript type of a `format: binary` body is `Blob`; the `File` is sent as the body with its own `Content-Type`. The UI expert checks that the generated client sends it unchanged.
- PR2, Next up card: `GenreFrame` gets an optional `coverUrl`. With a cover, an `<img alt="">` fills the card behind the content (`object-fit: cover`, so cropped, not stretched), over a scrim. The genre accent border and the genre icon stay (REQ-0026). Without a cover, or when the cover fails to load (`onError`), the genre pattern is shown as today. A `<img>` element is used, not a CSS background, because only an element has `onError`.
- PR2 contrast: the scrim is a token in `frontend/src/styles/global.css` (`--color-cover-scrim`, a dark colour with alpha). Its alpha is the value that makes the worst case pass. The worst case is a pure white image: the background behind the text is then the scrim composited over white, the brightest possible backdrop. The test computes that composite for each text colour used on the card and asserts at least 4.5:1 (3:1 for large text), and for the Join and Leave buttons it checks their own surfaces. This bounds every image, so it does not depend on which fixtures are sampled. REQ-0026's "lightest and busiest cover of the fixtures" is met by this bound, and the fixtures are only visual checks.

### 9. Gateway, edge and body limits
- Gateway: three routes in `services/gateway/internal/transport/router.go`, each `session: true` and each with `calendar` as upstream: `GET`, `PUT` and `DELETE /api/games/{gameId}/images/{kind}`. The contract test then passes. No body limit is added in the gateway, and no header filter (the proxy already passes `Content-Type`, `Cache-Control` and the query string). The `v` query is kept.
- Edge (`infra/edge/nginx.conf`): no change in PR1. The default `client_body_buffer_size` on 64-bit is 16 KiB. A raised buffer in the `http` block would apply to every route, and the body is read before the gateway checks the session, so an anonymous client could hold 512 KiB per connection (ADR 0009, amendment 2026-11-02, item 4, rejected that). Instead, an image upload over 16 KiB is written to `client_temp` on the edge container's disk for the length of the request. ADR 0009 item 4 already accepts this for bodies over 16 KiB: the file is transient, and no state is kept. 524288 bytes is below `client_max_body_size 1m`, which stays.
- Calendar, the global limit: `httpapi.LimitBody` (16 KiB, `pkg/httpapi/httpapi.go` line 16) is applied to every contract operation in the middleware list of `services/calendar/internal/transport/router.go` line 32. The `setGameImage` route must not be limited by it. The exemption lives in the calendar transport, not in `pkg/`: `pkg/` keeps `MaxBodyBytes` at 16 KiB. The exemption follows the existing pattern of `requireBodyKeys`, which is keyed by the route pattern (`r.Pattern`): the image upload is listed, and no other route changes.
- The handler of `setGameImage` reads `io.LimitReader(r.Body, MaxGameImageBytes+1)`. A body with more bytes than the limit is passed on as too large. A read error (the client went away) is `invalid_request` (400), as for JSON. Permission is checked before the size (point 3), and the read is bounded in both cases, so memory use is bounded for any caller.
- If oapi-codegen gives no typed body for the three image media types, the handler reads `r.Body` itself. The contract still declares the three types.

### 10. Security and privacy
| Threat | Countermeasure |
|---|---|
| Member or group admin uploads or removes an image | Permission in `application` (`Actor.IsSystemAdmin`), 403 before any check of the image (ADR 0011). The UI hides the controls, but that is not the protection. |
| A file that runs as something else (script in an SVG, HTML served as an image) | Bytes checked against three signatures. Only the three types are stored, served with their own `Content-Type` and `nosniff`. |
| Oversized body, memory | The read is bounded at the limit (point 9). Edge limit 1 MiB. |
| Enumeration of games or groups through the image route | An unknown game and a game without an image give the same 404. Membership is not revealed (the image is public game art). |
| Stale or reverted image shown from cache | The version is in the URL and must match. A version is the hash of the bytes (point 4). |
| External hosts, privacy | Nothing is loaded from another host. No CSP today (ADR 0018, point 6). When one is added, `img-src 'self'` is enough. |
| Images in logs | Only IDs, kind and actor are logged. |

### 11. Shortcuts and what is not built (YAGNI)
- Not built: a dimension check or decode of the image. A PNG or JPEG of 512 KiB can declare a very large size, and the browser then decodes it in full. The admin is trusted and the risk is self-inflicted. Shortcut: `shortcut: no decode, dimensions unchecked, upgrade with a stdlib image.DecodeConfig check (PNG and JPEG) and a WebP header parse if a viewer's browser is slow or fails`.
- Not built: resizing, cropping, converting, animated images, an editor in the app, more than one image of a kind per game, a web address instead of an upload.
- Not built: a per-kind size limit (the logo is shown small, so a lower limit would be possible). Shortcut: `shortcut: the admin game list loads full-size logos, upgrade with a smaller limit for logos or a stored thumbnail if the list is slow on the Pi`.
- Not built: a server-side cache, ETag, signed URLs, an image history or an audit trail of images.
- Not built: images on the landing page, on groups, on modes, on activities, on genres or on game roles (REQ-0026).
- Not built: the per-game accent colour of F-030. When it is built, it overrides the genre accent, as REQ-0026 says.

### 12. Delivery in two PRs, logo first, and who owns what
This ADR and the docs changes merge first (docs only, no code). Then:

| PR | Scope | Owner |
|---|---|---|
| PR1 (logo) | Migration `0010_game_images.sql` (up and down, both kinds in the CHECK). Contract: `GameImageKind` `[logo]`, the three operations, `Game.logoVersion`, `Lobby.gameLogoVersion`, the three error codes; regenerated Go and TypeScript output in the same PR. Domain rules (point 6), application `GameImages`, PostgreSQL repository, transport (the upload exemption from `LimitBody`), the joins for `logoVersion` and `gameLogoVersion`, the log line. Gateway: three routes. Frontend: `gameImageUrl`, `GameLogo`, `GameImageField` for the logo in the game form, the logo in the game list, on Next up and on the lobby page, error messages, tests. Backend first in the PR (the contract with it), then the frontend commit, so the UI builds on the generated types. | backend-expert (contract, calendar, gateway); ui-ux-expert (frontend). DevOps: none (point 9). |
| PR2 (cover) | Contract: `GameImageKind` `[logo, cover]`, `Game.coverVersion`, `Lobby.gameCoverVersion`. Joins for the cover in the same reads. No migration. Frontend: `GameImageField` for the cover in the game form, `GenreFrame` cover layer with the fallback, the scrim token and the contrast test. | backend-expert (contract, joins); ui-ux-expert (frontend). |

The docs change that merges first also updates `docs/services.md` and the glossary in `CLAUDE.md`. The product owner amends REQ-0026 (the "when I save" wording, point 1) and REQ-0009 (fields per game, REQ-0026 says so).

### 13. Tests
- Domain (unit): `SniffGameImage` accepts real header bytes of PNG, JPEG and WebP and refuses GIF, SVG, HTML, text, an empty body, a truncated PNG signature and a JPEG signature with a PNG name (Content-Type is not used). `MaxGameImageBytes` boundary: 524288 accepted at the size step, 524289 gives `image_too_large`. `GameImageVersion` is 64 lowercase hex characters and equals `sha256` of the bytes.
- Application (fakes): non-admin gets `not_allowed` even for an invalid image; size is checked before type; type before `game_not_found`; `Remove` is idempotent; `Image` refuses a missing or old `v`, and never returns the bytes for a non-current version.
- Transport: a 100 KiB image is accepted (regression: `LimitBody` does not apply to the upload); 524289 bytes gives 413 `image_too_large`; unknown `kind` gives 404 `game_image_not_found`; malformed `gameId` gives 404 `game_not_found`; `GET` sends `Content-Type`, `Cache-Control: private, max-age=31536000, immutable` and `nosniff`. Routes of the new operations match the contract.
- PostgreSQL (build tag `integration`): migration up, down and up; the CHECKs refuse an unknown kind, an empty image, an image over the limit and an unknown media type; deleting a game removes its images; `Save` on a missing game gives `game_not_found`; a replace keeps one row per kind; lobby list and lobby get give `gameLogoVersion` after a set and `null` after a removal and for an open lobby; a removed game leaves its lobby with the name and `null`.
- Gateway: the three routes are session routes; `v` and the upload body reach `calendar`; `routes_contract_test` passes.
- Frontend: `gameImageUrl` builds the URL from the three parts; `GameLogo` shows the image with `alt=""` when a version exists, the monogram without one, and the monogram after an image error (the name appears once as text); the form maps each error code to its message; the upload and removal show an inline status and no toast; the "Remove image" button is `danger`.
- PR2: the contrast test of point 8 with the real token values; `GenreFrame` shows the genre pattern without a cover and after a cover error.
- Contract: `npm run lint:api`, and the CI check that generated Go and TypeScript match `api/`.

## Consequences
- `calendar` owns one more table (`game_images`), three new operations on one path, and three new error codes. No new service, dependency or external call. `auth`, DevOps (no change, point 9) and `pkg/` are not affected.
- Each lobby list and game read carries two more `LEFT JOIN`s on the primary key of `game_images`. The cost is small.
- The admin page shows up to one full-size logo per game. The browser caches each image for a year, so a second visit costs nothing.
- A game with an image removed by its admin shows the genre theme or the monogram at the next read. An open tab asks for the old version until its next data load: while the old bytes are in the browser cache they still show; otherwise the request gets 404 and the monogram or the genre theme shows until the next data load.
- Replacing an image changes the version, so the old bytes stay in the browser cache but no URL names them any more.
- Rollback of the migration loses only the images. The API then has no image, every endpoint for them is 404, and the frontend falls back.

## Alternatives considered
- **Image in the game save (base64 in JSON or multipart).** Atomic, but costs a third more bytes, a larger body limit on every game write, an edge change, and a three-state field. See point 1. Possible later, as its own ADR, if the user wants a single save.
- **Storage port with a file or object adapter.** No object storage exists on the Pi. A volume breaks stateless containers. Rejected until a store exists (YAGNI).
- **Images in `auth`, like avatars.** `auth` owns identity. A game is calendar's, and `calendar` would otherwise call `auth` for each game image. Rejected.
- **A new media service.** A new service for one table with no separate deploy reason. Rejected (ADR 0017 makes the same argument for the game list).
- **`hasLogo` boolean and a fixed URL with ETag (ADR 0018 style).** A replaced image does not show on an open page. Rejected (point 4).
- **Multipart upload.** Parsing and a field name for a single file. A raw body with its own `Content-Type` is one thing to read.
- **Server-side image processing (resize, crop, re-encode) with an image library.** A new dependency for a logo at a fixed small size and a cover cropped by CSS. Rejected (point 6, YAGNI). The browser crops and scales.
- **Background image in CSS for the cover.** Simpler markup, but no `onError`, so a broken cover would show nothing. Rejected (point 8).
- **Contrast checked on sampled cover images.** Samples say nothing about an image not sampled. Rejected for the computed bound (point 8).

## Open questions
None for the user. Decided 2026-11-15 (DECISION, user): point 1 (immediate upload) and point 4 (GET for any logged-in user).
- ASSUMPTION (REQ-0026): 512 KiB is 524288 bytes, the same convention as the 16 KiB body limit. Limits: PNG, JPEG and WebP only, one limit for both kinds.
- For the product owner (in parallel, not in this ADR): REQ-0026 "when I save the game" becomes "when I choose the file"; REQ-0009 amendment.
