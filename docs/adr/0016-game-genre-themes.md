# 0016. Game genre: fixed list on the game, genre themes in the frontend
Status: Accepted (2026-11-07)
Amends ADR 0010 (genre only: read live from the game, unlike name and preset max)
Amends ADR 0015 (points 2, 4, 5, 6, 7 and 10, and a new fill cycle, section 8)
Merge order: ADR 0015 (branch `docs/adr-0015-three-js`, PR #60) merges before this ADR, because section 8 amends it.

## Context
REQ-0014 (F-032) gives each game an optional genre from a fixed list. A system admin sets it in the game list (REQ-0010, ADR 0010, ADR 0011). Lobby views show a theme for the genre: accent color, background pattern, icon and 3D motif. The theme follows the game, so a genre change shows on every lobby at its next view. The backend knows only the genre value; the look lives in the frontend. The landing hero (REQ-0013, ADR 0015) uses the same themes for its sample cards and runs the "lobby fills up" cycle of the REQ-0013 amendment of 2026-11-07.

Constraints that shape the design:
- A lobby keeps its own copy of the game name and max players (ADR 0010). The genre differs: it must follow the game, so it is read from the game, not copied into the lobby.
- The contract has no `gameId` on `Lobby`. The dashboard calls one lobby list per group (ADR 0014). The genre must arrive with the lobby responses that already exist, not through an extra game list call per group.
- REQ-0009 excludes extra per-game fields. REQ-0014 lifts that exclusion for the genre only.

## Decision

### 1. Values
Genre codes are lowercase, stable identifiers: `shooter`, `moba`, `racing`, `strategy`, `survival`, `party`, `rpg`, `sports`. The contract schema `Genre` in `api/calendar/openapi.yaml` is the list. The shown names are UI text in the i18n catalog, because genre names are not stored data (REQ-0014). "No genre" is `null`, as `defaultMaxPlayers` already is. There is no `none` value.

### 2. One authoritative list
The OpenAPI schema `Genre` is the source (ADR 0001). The other places that know the list:
- **Go `domain`:** the list the application checks. Domain code must not import generated code (ADR 0012), so the list is written once in `domain` as `domain.Genres()` and checked with `domain.IsGenre`.
- **SQL `CHECK` on `games.genre`:** a safety net, like the other checks of ADR 0010.
- **TypeScript:** no hand-written list. The generated `Genre` type drives `GENRE_THEMES: Record<GenreThemeKey, GenreTheme>` (section 7), so a genre without a theme is a compile error. The only runtime list of genres in TypeScript is `GENRE_OPTIONS`, which is derived from the keys of `GENRE_THEMES` (`Object.keys(GENRE_THEMES)`, without `neutral`). It is not a second list.

The two Go copies are kept equal by tests (section 10). There is no PostgreSQL `ENUM` type: changing it needs `ALTER TYPE`, and a `CHECK` is simpler to replace in a migration.

### 3. Data model
Migration `services/calendar/migrations/0005_game_genre.sql`:
```sql
-- +goose Up
-- The genre of a game (REQ-0014, ADR 0016). NULL means no genre. The list is the safety net here;
-- domain.Genres() is the Go list. Existing games get NULL, so nothing else changes.
ALTER TABLE games ADD COLUMN genre text
    CONSTRAINT games_genre_check CHECK (genre IN ('shooter', 'moba', 'racing', 'strategy', 'survival', 'party', 'rpg', 'sports'));

-- +goose Down
-- Only for rollback of a fresh install, or when the genre feature is withdrawn. It drops the genre of every game
-- (the only data this migration adds). Running up again gives every game no genre.
ALTER TABLE games DROP COLUMN genre;
```
- Rollback plan: `down` drops only the column. No lobby, name or other table is touched (no foreign key, ADR 0010).
- The runtime role `calendar` already has DML on `games` (ADR 0012), so no grant changes.
- A later change of the list is a new migration that drops and re-adds `games_genre_check`.

### 4. API contract
Changes in `api/calendar/openapi.yaml`. All are additive: no path is added or removed, and no existing field changes type.

a. New schema `Genre`:
```yaml
    Genre:
      type: string
      enum: [shooter, moba, racing, strategy, survival, party, rpg, sports]
      description: Genre of a game from a fixed list (REQ-0014, ADR 0016). `null` means no genre.
```
b. `Game` gets `genre`, and it is required, because the response always has the key:
```yaml
        genre:
          nullable: true
          allOf:
            - $ref: '#/components/schemas/Genre'
          description: The game's genre, or `null` for no genre.
```
`Game` is used by `GET /api/games`, `POST /api/games`, `PUT /api/games/{gameId}` and `GET /api/groups/{groupId}/games`.

c. `CreateGameRequest` and `ReplaceGameRequest` get the same property, not required. On PUT an omitted or `null` genre means no genre, the rule `defaultMaxPlayers` already has. The admin form therefore always sends `genre`.

d. `Lobby` gets `gameGenre`, and it is required. `LobbyDetail` inherits it through `allOf`. Every response that returns a `Lobby` or `LobbyDetail` sets it:
```yaml
        gameGenre:
          nullable: true
          allOf:
            - $ref: '#/components/schemas/Genre'
          description: Genre of the lobby's game as it is in the game list now. `null` for a custom name ("Other"), a game without a genre, or a game that was removed. Not stored in the lobby, so a genre change shows at the next read.
```

e. `ErrorBody.code` enum gets `invalid_genre`, after `invalid_capacity`.

f. The descriptions of `createGame` and `replaceGame` list `invalid_genre` (400) and the new step in their rule order.

Why `gameGenre` on `Lobby`: the dashboard, the lobby list and the lobby page already receive lobbies. The genre comes with them at no extra request. A `gameId` on `Lobby` would still need a game list fetch, and joining by name is fragile, so neither is used.

### 5. Writes and errors
- Rule order of `POST /api/games` and `PUT /api/games/{gameId}` (ADR 0010, ADR 0001): invalid JSON or a wrong JSON type gives `400 invalid_request` (transport). Then permission (`403 not_allowed`, before any domain check). Then the validation steps: name (`invalid_game`), default max (`invalid_capacity`), genre (`invalid_genre`). Then `404 game_not_found` on PUT, then `409 game_taken`.
- A genre value not in the list gives `400 invalid_genre`. The contract enum is not enforced at runtime (ADR 0012, decision 5). The domain checks it.
- Successful writes are logged as today, with `actorUserId`, `gameId` and action. No history is kept.

### 6. Read path (backend)
- The lobby queries (list, get, and the response of create) get `gameGenre` from `LEFT JOIN games ON games.id = lobbies.game_id`. Both tables belong to `calendar`, and there is no foreign key (ADR 0010). A removed game has no row, so the result is `null`.
- The create response takes the genre from the `GameCatalog.Find` result that `CreateLobby` already uses (REQ-0003). No new query and no new port.
- `lobbies` stores no genre.

### 7. Frontend theme module
A new shared module `frontend/src/genres/`, like `ui/` and `calendar/`. Features import only its `index.ts`.

- `genreThemes.ts` (main chunk, pure data, no React, no three.js):
  - `type GenreThemeKey = Genre | "neutral"`.
  - `type MotifKind = "reticle" | "towers" | "chevrons" | "grid" | "peaks" | "confetti" | "frame" | "ball" | "pin"`. This is the closed set of 3D motif shapes. Each kind has a 3D builder in `heroScene.ts`.
  - `type MotifDescriptor = { kind: MotifKind; count: number }`. `count` is the number of repeated parts (1 to 12). It is plain data.
  - `GenreTheme = { key, accentVar, patternUrl, iconUrl, motif: MotifDescriptor, motifUrl }`. `accentVar` names a CSS custom property. The URLs are absolute paths of static files (art, below).
  - `GENRE_THEMES: Record<GenreThemeKey, GenreTheme>`. Every key has an entry, including `neutral`, and every entry has a `motif` descriptor. The motif of each genre is defined here and only here. The neutral motif is `{ kind: "pin", count: 1 }`. No key is without a descriptor.
  - `themeForGenre(genre: Genre | null): GenreTheme`. `null` gives `neutral`. An "Other" lobby also gets `neutral`, because its `gameGenre` is `null`.
  - `GENRE_OPTIONS: readonly Genre[]`, derived from the keys of `GENRE_THEMES` (section 2).
- `GenreFrame.tsx`: the only component that draws theme visuals. It wraps a lobby view, sets `--genre-accent` from `accentVar`, draws the pattern, and renders the icon and the flat motif as `img alt="" aria-hidden="true"`. It renders its children on top. It has no motion.
- Flat motif art: `motifUrl` is a static SVG of the same key. It is the picture of the descriptor for lobby views, not a second definition: the descriptor says what the motif is, and the SVG shows that kind and count in flat form. The UI/UX expert checks the SVG against the descriptor.
- Art: static SVG files in `frontend/public/genre-art/<key>-pattern.svg`, `<key>-icon.svg` and `<key>-motif.svg`. They are referenced by path, not imported as modules. Vite inlines imported files under 4 KB into the main bundle, which would break the main chunk budget of ADR 0015.
- Colors: nine custom properties `--color-genre-<key>` in `frontend/src/styles/global.css`, one per key including `neutral`. This file holds the only hex values.
- Labels: `messages.genre` in `frontend/src/i18n/messages/en.ts`, typed `Record<Genre | "none", string>`, so a missing label is a compile error. `none` is the form's "No genre". A neutral theme has no label in themed views. The game name and the generic icon carry its meaning (REQ-0014, WCAG 1.4.1).
- Where the theme shows: lobby lists and the lobby page (`features/lobbies`), dashboard "Next up" and "This week" (`features/dashboard`), and week calendar blocks (`calendar/`, which receives the theme from the feature as a prop). Each lobby view uses `gameGenre` from the response it already has.
- Views show the genre name as text in lobby lists, on the dashboard and on the lobby page. In week blocks the name is shown only if it fits (UI/UX expert decides).
- Admin game form (`features/games`): a select over `GENRE_OPTIONS` plus "No genre" (`null`). The form always sends `genre` on save.
- Error `invalid_genre` gets a message from the code, as ADR 0013 requires.

### 8. Landing hero (amends ADR 0015)
ADR 0015 covers the static hero with fixed cards. It does not cover the "lobby fills up" cycle of the REQ-0013 amendment of 2026-11-07. This section adds that, and changes the points named in the header. The timing and the sample cards follow that amendment.

**Single source for the sample cards and the timing (amends point 6).** `hero.ts` (main chunk) is the only place that holds the sample data and the timing. It exports:
```ts
export const HERO_TIMING = { enterSeconds: 1, stepSeconds: 1, glowSeconds: 1.5, leaveSeconds: 1 } as const;

export const HERO_SAMPLE_CARDS = [
  { gameName: "Sample shooter", genre: "shooter", startCount: 2, maxCount: 5, startTime: HERO_SAMPLE_START },
  { gameName: "Sample racing", genre: "racing", startCount: 1, maxCount: 4, startTime: HERO_SAMPLE_START },
  { gameName: "Sample party", genre: "party", startCount: 3, maxCount: 8, startTime: HERO_SAMPLE_START },
] as const satisfies readonly HeroSampleCard[];
```
`HERO_SAMPLE_START` is the fixed sample start date of ADR 0015, so the time text does not depend on the clock. The three sample cards are in cycle order. Their genres come from REQ-0014 and each card uses `themeForGenre(genre)`. The hero uses the `Genre` type from `genres`. It still never uses `Lobby`, `lobbyId`, `Player` or an API client, and fetches nothing. Avatars are initials or abstract dots (REQ-0013), with no real member name. The hero defines no theme and no motif of its own.

**Derived durations.** A sample card's cycle is computed, not fixed:
`heroCardSeconds(card, timing) = enterSeconds + (maxCount - startCount) * stepSeconds + glowSeconds + leaveSeconds`.
With the constants above the durations are 6.5 s (shooter, 3 arrivals), 6.5 s (racing, 3 arrivals) and 8.5 s (party, 5 arrivals), all within the REQ-0013 range of 6 to 10 seconds. The whole cycle is their sum, 21.5 s, and it repeats.

**Cycle state (new module, main chunk).** `heroCycle.ts` is pure: no timers and no DOM. It takes the cards and the timing as arguments and imports nothing from `hero.ts`, so its tests can use any cards. It exports:
- `heroCardSeconds(card, timing)`, as above.
- `heroFrameAt(elapsedSeconds, cards, timing): HeroFrame`, where `HeroFrame = { focusIndex, count, phase: "enter" | "fill" | "full" | "leave" }`. The elapsed time is taken modulo the sum of all card durations, so the cycle restarts with the first card after the last and has no end state. Inside a card: `enter` for `enterSeconds`; then `fill`, where one avatar arrives every `stepSeconds` and `count = min(maxCount, startCount + floor((t - enterSeconds) / stepSeconds))`; then `full` at `maxCount` for `glowSeconds`; then `leave` for `leaveSeconds`.
- The card behind is `(focusIndex + 1) % cards.length`, shown at its `startCount` at rest. It needs no state.

The elapsed time is the one that `startHeroLoop` already keeps (ADR 0015 point 7, clamped to `HERO_MAX_FRAME_SECONDS`). A pause stops that clock, and a resume continues from the same point. No second clock exists.

**Scene update (amends points 2 and 4).** The port gains one method:
```ts
export interface HeroScene {
  update(frame: HeroFrame, cards: readonly HeroSampleCard[]): void; // repaints only the changed card's texture and meter
  render(elapsedSeconds: number, pointer: HeroPointer): void;
  setSize(width: number, height: number): void;
  dispose(): void;
}
```
`startHeroLoop` calls `update` only when the frame key (focus, count, phase) differs from the last one, so a canvas is not repainted on every frame. `lobbyCardPainter.ts` gets the accent, the pattern and icon images and the card text as arguments, and paints a state (count, glow, phase). It has no theme knowledge.

**Motif in the scene (amends point 2).** `heroScene.ts` (lazy chunk) imports from `genres` with `import type` only: `GenreThemeKey`, `MotifKind` and `MotifDescriptor`. `createHeroScene(container, cards, maxPixelRatio)` receives each card's `motif: MotifDescriptor`, taken from `themeForGenre(...).motif`, as an argument. Its `Record<MotifKind, (count: number) => Object3D>` turns a kind into three.js geometry. The motif data is in `genreThemes.ts`, so `heroScene.ts` holds no definition of which genre has which motif. Three.js stays out of the main chunk.

**Static frame.** The static frame (reduced motion or no WebGL, ADR 0015 point 5) shows the focused sample card (index 0, at its `startCount`) and the card behind it (index 1, at its `startCount`) at rest. Their contents differ in name, time, count and genre. It is painted once. No loop and no timer run. It is painted after the pattern and icon images have loaded, so there is no blank area. The stage has a fixed size (`aspect-ratio` in CSS), so the cards do not shift when images arrive. If an image fails to load, the card is painted without it, and the error is logged once with `console.error` (no silent catch).

**Tests (add to ADR 0015 point 10).**
- `heroCycle.test.ts`, with a fake elapsed clock:
  - one arrival per step: the count goes from `startCount` to `maxCount` by exactly one per second, and the text and the meter follow;
  - the `full` phase lasts `glowSeconds` at `maxCount`, and the `leave` phase lasts `leaveSeconds`;
  - the next card enters after the leave;
  - the cycle restarts with the first card after the last;
  - the durations are 6.5, 6.5 and 8.5 seconds, derived from `HERO_TIMING` and `HERO_SAMPLE_CARDS`, and each is within 6 to 10 seconds.
- `heroLoop.test.ts`: a pause and a resume continue the frame from the same point; `update` is called only when the frame key changes.
- `lobbyCardPainter.test.ts`: the text drawn for each state; the full state uses the glow token color.
- Static frame test: `vi.getTimerCount()` is 0 and `requestAnimationFrame` is not called; the focused card and the card behind differ in name, time, count and genre.
- Layout at 320 and 390 px is checked by hand (REQ-0013), with no layout shift.

### 9. Glossary, requirements and service map
- `CLAUDE.md` glossary: **Genre** points to this ADR and the contract schema `Genre` (the values are not repeated there). **Genre theme** (`GenreTheme`, `themeForGenre`, `genreThemes.ts`) is frontend only. The error code `invalid_genre` is listed in the contract only.
- REQ-0009 needs an amendment, written by the product owner: a game has one optional field, `genre`, set by the system admin in the game form (REQ-0014, ADR 0016). No other field is added.
- `docs/services.md` is updated in the same change: `calendar` owns `games.genre` and realizes F-032 (data only), and `frontend` lists genre themes in its responsibility. No new dependency and no new service.

### 10. Tests
- Go `domain`: `NewGame` with each genre and `nil`; an unknown value; `Shooter` with a capital letter is rejected; `Genres()` and `IsGenre` agree.
- Go contract consistency: the generated `Genre` constants equal `domain.Genres()`, as sets. This keeps the two copies equal.
- Go `application` (fakes): `invalid_genre` after permission; `not_allowed` before validation. A non-admin cannot set, change or clear a genre (POST and PUT with `genre`), and the game is unchanged. A PUT without `genre` sets no genre.
- Go transport: a number as `genre` gives `invalid_request`.
- Go `postgres` (real PostgreSQL): every domain genre is stored and read; an unknown value fails the `CHECK`; `up`, `down`, `up`.
- Go `postgres` lobbies: `gameGenre` changes when the game's genre changes; a removed game and a custom-named lobby give `null`; a game without a genre gives `null`.
- Frontend `genres`: `themeForGenre` returns a distinct accent, distinct art and a distinct motif descriptor for each key, and `neutral` for `null`; `messages.genre` has every label; `GENRE_OPTIONS` equals the keys of `GENRE_THEMES` without `neutral`.
- Frontend views: a lobby with a genre shows the genre name as text in lobby lists, on the dashboard and on the lobby page; a neutral lobby shows no genre name.
- Reduced motion: with `prefers-reduced-motion: reduce`, the hero's mode is static (no loop, no timer), and no theme element has a CSS animation.
- WCAG contrast: a unit test reads the nine `--color-genre-*` values and the text and background tokens from `global.css`, and computes the ratios. Text on background is at least 4.5:1. Each accent against its background is at least 3:1. The neutral key is included.
- Hero: section 8 tests.

### 11. Adding a genre later (checklist)
1. `Genre` enum in `api/calendar/openapi.yaml`, then generate.
2. `domain.Genres()`.
3. A migration that replaces `games_genre_check`.
4. A `GENRE_THEMES` entry with accent, art and motif descriptor (`kind` and `count`). Three SVG files and one `--color-genre-<key>` token. The message label. The compiler and the tests show what is missing.
5. A new `MotifKind` only if no existing kind fits. Then add its builder to the `Record<MotifKind, ...>` in `heroScene.ts`.

### 12. Rollout
The backend change and the admin form ship in one change. An old browser tab that still runs the form without `genre` would otherwise clear the genre of a game on save. A form that does not send `genre` is a bug under section 7.

## Consequences
- Only `calendar` (service, data, contract) and `frontend` change. No new service, endpoint path, gateway route, dependency or asynchronous call. `auth`, `gateway` and DevOps are not affected.
- The admin form must send `genre` on every save. This is the reason for the PUT rule and is checked in review.
- The lobby queries join `games`, which is cheap in the same database.
- A genre change reaches all lobbies at their next read. Lobbies created before keep their name and max players as before.
- The genre values exist in four places: the contract, the Go domain, the SQL check and the generated TypeScript type. Section 11 lists the steps. The tests in section 10 check the two Go copies.
- Existing games have no genre and show the neutral theme. Nothing else changes for them.
- Lobby list responses grow by one field, `gameGenre`. Clients ignore unknown fields, so this is non-breaking.
- ADR 0015 is amended as in section 8. Its file stays as it is on its branch; the amendment is recorded here.

## Alternatives considered
- **Copy the genre into the lobby at creation.** Rejected: a genre change would not reach existing lobbies, which REQ-0014 requires. It is also a second copy of data.
- **The frontend joins the game list to the lobbies.** Rejected: it needs a game list call per group (ADR 0014 already has one call per group), and lobbies have no `gameId`. Joining by name is fragile.
- **`gameId` on `Lobby`.** Rejected: it answers the question only with a further call. `gameGenre` answers it directly.
- **A `genres` table with a foreign key.** Rejected: the list is fixed code, not admin-managed data (REQ-0014). A table adds a join and a migration for nothing.
- **A PostgreSQL `ENUM` type.** Rejected: adding a value needs `ALTER TYPE` and is harder to roll back than a `CHECK`.
- **A `none` value in the enum.** Rejected: `null` is the existing rule for an optional field (`defaultMaxPlayers`).
- **Store display names ("MOBA") as values.** Rejected: values would change with translations. Codes are stable.
- **Omitted `genre` on PUT keeps the current value.** Rejected: PUT replaces the whole game (ADR 0010), and this field must follow the same rule as `defaultMaxPlayers`.
- **A `GET /api/genres` endpoint.** Rejected: the list is in the contract and generated for the frontend. No call is needed.
- **A runtime enum validation middleware.** Rejected: ADR 0012 decision 5. The domain check is the one place that enforces the list.
- **Theme values from the backend (colors, pattern names).** Rejected: REQ-0014 says the backend knows only the genre value. The look is the frontend's.
- **Art imported as modules.** Rejected: small files would be inlined into the main bundle (section 7).
- **The motif defined in the hero scene.** Rejected: the hero must not own motifs. The motif is theme data, and the scene only maps its kind to geometry.
- **Fixed 8 s cards.** Rejected: the REQ-0013 amendment defines the phases and the sample counts, so the duration follows from them.
- **Three.js motif in lobby views.** Rejected: REQ-0014 requires a static motif there. Only the hero moves it.
- **A separate `genreTheme` feature.** Rejected: features may not import each other's internals, and the theme is shared. A shared module is the right place.
- **Per-game accent color (F-030).** Not built now (YAGNI). A later change adds an `accent` field to `Game` and an optional override in `themeForGenre`, and changes nothing in this design.
