# Project instructions

This project is run by a team of agents. The main session is the **orchestrator** and delegates work to the specialist agents in `.claude/agents/`. All agents follow the rules in this file.

@.claude/agents/orchestrator.md

---

## Language

The repository is in English: code, comments, documentation (ADRs, service map, product documents, agent files, this file) and commit messages. Agents report to the orchestrator in English.

## Team

| Agent | File | Responsibility | Owns |
|---|---|---|---|
| Orchestrator | `orchestrator.md` | Plans, delegates, coordinates, closes tasks | Task flow |
| Product owner | `product-owner.md` | Decides what is built, prevents duplicate functionality, requirement specification | `docs/product/` |
| Architect | `architect.md` | Design, service boundaries, ADRs, interpretation of the rules | `docs/adr/`, `docs/services.md`, code standard |
| Reviewer | `reviewer.md` | Strict review of all code against architecture and code principles | Review reports (changes no code) |
| UI/UX expert | `ui-ux-expert.md` | Interface, user flows, accessibility | `frontend/`, `docs/design/` |
| Backend expert | `backend-expert.md` | Services, API, domain logic, auth, database | `services/`, `api/`, `pkg/` |
| DevOps expert | `devops-expert.md` | Build, CI/CD, operations, environments, monitoring | `infra/`, `.github/`, Dockerfiles, `compose*.yml` |

An agent only changes files within its own area. If a change is needed outside it, send it as a request to the orchestrator.

## Glossary

This is the single shared vocabulary. Use these exact English terms in documents, code, API contracts, database schemas and error codes. Product documents use the same terms. If a term is missing, the architect adds it here before it is used elsewhere.

| Term | Technical form | Notes |
|---|---|---|
| Group | `groups` | |
| Member | `group_members` | |
| Join (membership starts) | `joined_at` | |
| Leave group | `DELETE /api/groups/{groupId}/membership` | |
| Group admin | role value `admin` | |
| System admin | `isSystemAdmin`, `X-User-System-Admin` | Set in configuration only (ADR 0011) |
| Invite link | `invite_links`, `/api/invites/{token}` | |
| Link creator | `createdByUserId` | |
| Max uses | `maxUses` | 1–10, default 1, set at creation |
| Use (of a link) | `useCount` | Increases by 1 per join via the link |
| Link expiry | `expiresAt` | 10 minutes after creation |
| Join group via link | `POST /api/invites/{token}/join` | |
| Is member | `isMember` | In `InviteInfo` |
| Lobby | `lobbies`, `lobbyId`, schemas `Lobby` / `LobbyDetail` | A bookable slot in a group |
| Creator | `createdByUserId` | Creator of a lobby |
| Player | `lobby_players`, `players`, `playerCount` | A person who has joined a lobby |
| Join a lobby | `PUT /api/groups/{groupId}/lobbies/{lobbyId}/players/me` | |
| Leave a lobby | `DELETE /api/groups/{groupId}/lobbies/{lobbyId}/players/me` | |
| Spot / max players | `maxPlayers` | Shown as "3/5 players" |
| Game | `gameId`, `gameName` | |
| Game list | `games` | Managed by system admin |
| Other | `customGameName` | Free-text game name |
| Genre | `genre` (on a game), `gameGenre` (on a lobby) | Fixed-list category of a game, one per game, optional; `null` means no genre. The values are the `Genre` schema in `api/calendar/openapi.yaml`. Names are UI text (ADR 0016) |
| Genre theme | frontend only. The code (`GenreTheme`, `themeForGenre`, `genreThemes.ts`) is deleted (PR5b, ADR 0028 section 7) | Removed from the UI (REQ-0029 item 10): no tint, pattern, icon, motif, stripe or cover. The genre value stays stored and editable in the game form (ADR 0016). Do not use for new visuals. |
| Accent stripe | frontend only | Removed (REQ-0029 item 10, ADR 0028 section 7). Its code is gone. Do not use. |
| Game image | table `game_images` (`kind`: `logo` only), `GameImageKind` (`logo`), `/api/games/{gameId}/images/{kind}` | A picture uploaded by the system admin for a game, at most one per game, at most 512 KiB, PNG, JPEG or WebP, checked by its bytes. Stored in `calendar`. Served with the version in the URL (ADR 0026, amended 2026-11-25: the cover kind is removed). Avoid: picture, artwork, asset, file, thumbnail |
| Game logo | `logoVersion` (`Game`), `gameLogoVersion` (`Lobby`, `PreferredGameRole`); frontend `GameLogo` | The game image of kind `logo`: shown beside the game name in the game form, the game list, the game choice (Game choice), the Game roles headings of the You page, the lobby page (4rem), the list rows of the Group view and the Game chips (2.5rem). Not in running order blocks, Next up, the Group cards or the landing page (REQ-0029 item 10, ADR 0028 section 7). Exception: in a Game chip the game name is not shown as text; it is in the chip's accessible name and its Popover, and the logo is `aria-hidden` (REQ-0021 Amendment 2026-11-17, ADR 0022 Amendment 2026-11-17, ADR 0026 Amendment 2026-11-17). Without one, the Monogram. The name is always shown as text beside it, and the logo is never part of a label string (REQ-0026, ADR 0026). Avoid: game icon, badge, emblem, brand mark |
| Game cover | none (removed) | Removed (REQ-0026 Amendment 2026-11-25, ADR 0026 Amendment 2026-11-25). Do not use. |
| Monogram | frontend only (`GameLogo` draws `initialsOf` of the game name in its own square; not `Avatar`) | The initials of a game's name, shown where a game logo is missing or fails to load (REQ-0026, ADR 0026), and in a Game chip (REQ-0021 Amendment 2026-11-17). Not in running order blocks (REQ-0029). Avoid: placeholder logo, fallback icon |
| Game chip | frontend only (`GameChip`, `frontend/src/features/groups/GameChip.tsx`) | The compact item of a Member list row for one game of a member's preferred game roles: the Game logo or Monogram at 2.5rem, then each Role icon of that game once, and the name of each role that has no Role icon (a visible token is shown once per game). Its accessible name and its Popover hold the full text, the same sentence as the lobby note. One chip per game, in the order the server sends them; the chips wrap. Avoid: badge, tag, pill, role chip, role summary, item (alone) (REQ-0021 Amendment 2026-11-17, ADR 0022 Amendment 2026-11-17) |
| Tab bar | frontend only (class `.tab-bar`, the `nav` of `TopBar`, `frontend/src/features/shell/TopBar.tsx`) | The bottom navigation of phones (under 760 px): Home, Groups and You. It is the same nav as the Top bar's tabs, moved by CSS (ADR 0028 section 3). Avoid: tab strip, menu, footer nav |
| Wordmark | frontend only (rendered by `TopBar`, `frontend/src/features/shell/TopBar.tsx`) | The text logo "OpenLobby" in the Top bar and in the phone top bar. Uppercase by CSS, not by the text (ADR 0028 sections 2 and 3). Avoid: logo (alone), brand mark |
| Top bar | frontend only (`TopBar`, `frontend/src/features/shell/TopBar.tsx`, class `.top-bar`, a `header` with the nav) | The orange bar at the top of every logged-in page, at every width: from 760 px with the Wordmark "OpenLobby", the text tabs Home, Groups and You, and my avatar with my display name; under 760 px with the Wordmark and the avatar only (the tabs are the Tab bar). REQ-0029 item 3, ADR 0028 section 3 and Amendment 2026-11-21 (section 16.4). Replaces the Group rail. Avoid: header, navbar, app bar, menu bar |
| Group rail | frontend only | Superseded by the Top bar (REQ-0029, ADR 0028). Do not use. |
| Dashboard | `/` when logged in (ADR 0014) | The home screen after login: the Next up band and the running order across all the user's groups (REQ-0012, REQ-0029). Not the group list. Shown as "Home" in the app (the Top bar and Tab bar tabs and the page heading; REQ-0028 item 6, ADR 0014 Amendment 2026-11-18). Avoid: Dashboard as a visible word |
| Next up | frontend only (`nextUp`), no API field | The lobby that starts first among all lobbies of the user's groups, shown in the Next up band above the running order on Home (ADR 0028 section 4). Running lobbies count |
| Next up band | frontend only (`NextUpBand`, in `features/dashboard/`) | The surface band at the top of Home (ADR 0028 Amendment 2026-11-21) that shows Next up: the eyebrow, the start time in the largest size, the label, the date, the time range, the spots, my role slots and the join or leave button (REQ-0029 item 4). It replaces the Next up card and its side column. Avoid: Next up card, card, banner |
| This week | frontend only (`thisWeek`) | The lobbies that start in the current week (Monday to Sunday, local time), across all groups, shown as the running order on Home (ADR 0028). Avoid: week grid |
| Now line | frontend only (`.running-order__now`, drawn by `RunningOrderDay`) | The 2 px signal (orange) line at the current time in today's row of the running order, over a 4 px ground line (ADR 0028, Amendment 2026-11-21 section 16.7). Not shown in other rows or weeks, and not announced by a screen reader. Avoid: current-time marker, red line |
| Running order | frontend only (`RunningOrder`, `frontend/src/runningOrder/`) | The week view of Home and of a group's Calendar view: one row per day from Monday to Sunday, time runs left to right over 00:00 to 24:00, of which at most 16 hours are visible on a wide screen (never under 4.5rem per hour) and the rest scrolls sideways inside the component (about 6 hours on a phone; ADR 0028 Amendment 2026-11-21 section 16.13), and a lobby is a block of its real length in its group colour (ADR 0028 section 4). Replaces the week time grid of REQ-0004 and REQ-0019. Avoid: week grid, time grid, timeline, Gantt, calendar grid |
| Running | derived from `startsAt` and `endsAt` | Lobby state from start time until end time. Shown on Next up instead of the countdown |
| Ended | derived from `endsAt` | Lobby state after the end time (REQ-0005). Joining then gives `lobby_has_ended` |
| Joined by me | `joinedByMe` | `true` when the caller is a player of the lobby. On `Lobby` (ADR 0014) |
| Group list | page `/groups`, data `GET /api/group-overviews` (ADR 0025). `GET /api/groups` is the plain list of the dashboard (ADR 0014) | The groups the user is a member of, opened by the Groups tab, one Group card each. Not the Game list |
| Group overview | `GroupOverview`, `GET /api/group-overviews` | The data of one group on the Group list: name, `memberCount`, the first five `members`, `nextLobby`. Avoid: group summary (that is `GroupSummary`: id and name only) (ADR 0025) |
| Group card | frontend only (`GroupCard`) | One group's item on the Group list, built from a Group overview: name, member count, up to five avatars or initials with "+N", and the next lobby line. One card is one link to the Group view. Avoid: tile, item, row, box (REQ-0024) |
| Next lobby | `nextLobby` on a Group overview (`NextLobby`) | The lobby of one group that starts first among its lobbies that have not ended. Running lobbies count. The Next up rule (REQ-0012) for one group (ADR 0025) |
| Group view | `/groups/{groupId}` | A group's page inside the app shell: upcoming lobbies, members and invite links |
| Line-up | frontend only (the List view of the Group view, `LobbyList`) | The group's upcoming lobbies grouped by day under day headings, each row with the large start time, the end time, the label, the role slots and the spots (REQ-0029 item 5). Avoid: agenda, schedule |
| Group colour | frontend only (`groupColorIndex`, `frontend/src/groupColor/`, tokens `--color-group-1` to `--color-group-6`) | The colour of a group's running order blocks, its square and its legend entry, derived from the group ID (FNV-1a, mod 6; ADR 0028 section 5). Not stored, no API, no choice. The group name is always shown with it. Avoid: group icon, group badge, team colour, theme |
| Member list | frontend only (the members section of the Group view, `frontend/src/features/groups/GroupDetails.tsx`) | One row per member of a group: the name, the admin marker and the member's Game chips (REQ-0021 Amendment 2026-11-17). In the side column from 98rem window width (REQ-0025); below 98rem it sits below the lobbies. "Leave group" is not in this panel: it is the last item on the Group view, below the Group feed in the side column, or after the Member list below 98rem (REQ-0006, REQ-0028 item 7). Avoid: members list, roster, people list |
| Main area | frontend only (`.shell__main`, token `--width-app`) | The box of the app shell, below the Top bar and centred. Its maximum width is 100rem, measured including the `.shell__main` padding (REQ-0025, ADR 0028 section 8). Applies to all logged-in pages; text blocks inside keep a bounded measure (`--width-measure`, 48rem). Avoid: content area, container, wrapper, page width |
| Main column | frontend only (no class of its own: the first grid track of `.side-layout`) | The part of a page with its primary content: the running order, the line-up, the players, the group cards. Avoid: left column, content column, primary column (REQ-0025) |
| Side column | frontend only (class `.side-column` in `.side-layout`, grid `minmax(0, 1fr) var(--width-aside)`, token `--width-aside`, 19rem; DECISION: one breakpoint for all pages at 98rem window width) | The column on the right beside the main column, from about 98rem window width, on the Group view and the lobby page only (ADR 0028 section 8). Holds secondary content only: members and Group feed (Group view), lobby facts and settings (lobby page), and on the Group view the "Leave group" button below the Group feed. Not shown when it would be empty. Avoid: sidebar, right panel, secondary column (REQ-0025, REQ-0029) |
| Skip link | frontend only (`SkipLink`, `frontend/src/ui/SkipLink.tsx`, class `.skip-link`, text `skipToContent`) | The first keyboard stop of the app shell and the landing page, visually hidden until focused, that moves focus to `main` (id `main`). WCAG 2.4.1, REQ-0029 item 12, ADR 0028 section 16.12 item 3. Avoid: skip nav, jump link, bypass link |
| Game mode | `game_modes`, `gameModes`, `modeId`, `modeName` | A kind of play within a game, with its own limit: its game roles (their sum is max players) or a max players value. Entered by the system admin. Avoid: type, category, difficulty, queue, playlist (REQ-0015, ADR 0017) |
| Named activity | `activities`, `activityId`, `activityName` | A specific thing played in a mode, e.g. a particular dungeon. Optional, at most one per lobby, belongs to exactly one mode. Avoid: instance, content, map, boss, target. Do not use the bare word "activity" for anything else. Today it means the order of permission checks in `api/calendar/openapi.yaml` (line 295), its generated copy `frontend/src/api/gen/calendar.ts` (line 140) and `services/calendar/internal/application/invite_links.go` (lines 128, 162); PR2 of ADR 0017 rewords them |
| Open lobby | no `modeId` (`lobbies.game_mode_id` NULL) | A lobby with no mode: with no game (shown as "Open") or with a game only. Game and mode can be set later (REQ-0015, ADR 0017). Avoid: free lobby, unnamed lobby, drop-in |
| Label | frontend only (no API field) | The text a lobby shows in lists, Next up, This week and on its page: "game › mode › activity", or "Open" with no game (ADR 0017). The game logo may sit before the label as a separate decorative element; the label itself is always text (ADR 0026 items 10, 11). Avoid: title (a lobby has no title field) |
| Game role | `game_roles`, `gameRoles`, `gameRoleId` (on a player; `null` means flex) | A named role of a game, or of a mode of a game, with slots, e.g. "Tank". Entered by the system admin. Not the group role `role` (`admin`, `member`). Avoid: role (alone), position, class (REQ-0011, ADR 0017) |
| Role icon | `roleIcon` (`GameRole`, `RoleSlot`, `PreferredGameRole`); columns `game_roles.role_icon`, `lobby_role_slots.role_icon` | The icon of a game role, from the fixed set `shield` (Tank), `medical-cross` (Support, Healer), `dagger` (DPS, Damage), `crosshair` (Sniper, Ranged), `wrench` (Engineer), `star` (other), and `none` (the admin chose No icon). `null` means not chosen yet: shown as no icon, and the game form suggests one from the role name. Saved only when the admin saves the form. Lobby role slots keep the icon they were copied with. Shown before the game role's name in role slots, the seat choice, the lobby player group headings and the You page; never on Flex, and not on Next up or This week labels (REQ-0023, ADR 0024). In a Game chip of the Member list the icon is shown alone, without the name; a role with no icon (`null` or `none`) shows its name there instead (REQ-0021 Amendment 2026-11-17). Avoid: game icon, badge, emblem |
| Preferred game role | `preferred_game_roles`, `preferredGameRoles` (on `Member`, `LobbyPlayer`), `gameRoleIds` (`/api/users/me/preferred-game-roles`); on `PreferredGameRole`: `gameId`, `gameLogoVersion`, `roleIcon` (ADR 0022 Amendment 2026-11-17) | A game role that a person says they usually play. One choice for all groups. Preselects the seat when the person joins a lobby of that game, and is shown to the members of the groups the person shares: in the Member list as Game chips (one per game), in the lobby player list as text (REQ-0021 Amendment 2026-11-17). Avoid: favourite role, main role, class, preferred role (alone) (REQ-0021, ADR 0022) |
| Goal | `goals`, `GET /api/users/me/goals`, `PUT` and `DELETE /api/users/me/games/{gameId}/goals/{itemId}` | One item that a person wants from one game. One set for all groups, as Preferred game role. Shown in the You page Goals section and, next to the player, on the lobby page when the item is on the lobby's drop list. Not shown in the member list. Avoid: wish, wish list, want, target (REQ-0030, ADR 0029) |
| Drop list | `drop_items`, `GET /api/games/{gameId}/items`, `PUT` and `DELETE /api/games/{gameId}/activities/{activityId}/items/{itemId}` | The items that can drop in one Named activity (a dungeon or a raid), entered by hand by the system admin, in the order entered. Removed with its Named activity. Avoid: loot table, loot list (REQ-0030, ADR 0029) |
| Item | `itemId` (integer, the Blizzard item ID), `Item` schema, `GET /api/items/{itemId}/icon` | A game item, identified only by its Blizzard item ID. The app stores no name, icon or description of it beyond the cache of ADR 0029. Avoid: gear, loot, reward, item database (the app has none) (REQ-0030, ADR 0029) |
| Item icon | frontend `ItemIcon`, `itemIconUrl`; served by `GET /api/items/{itemId}/icon` | The picture of an item, fetched from Blizzard by calendar and served from our own origin, kept only in the cache (ADR 0029 section 4). Not the Game logo, which the system admin uploads and we store (ADR 0026). Avoid: item image, item picture, loot icon, artwork (REQ-0030) |
| Item catalog | `ItemCatalog` (port in calendar `application`), adapters `blizzard` and `blizzardcache` | The port through which calendar reads an item's English name and icon. The only adapter that talks to Blizzard is `blizzard`. Avoid: item database, item store, item source (REQ-0030, ADR 0029) |
| Attribution | frontend only (the text "Data from Blizzard", one shared component) | The credit to Blizzard, shown once on each page where item names or icons are shown, as Blizzard's terms require (ADR 0029). Avoid: credit line, source note, footer, disclaimer (REQ-0030) |
| Known item | the item status `known` | An item whose English name Blizzard gave. Shown with its name, and with its Item icon when that loads. Avoid: found, valid, ok (REQ-0030, ADR 0029) |
| Unknown item | the item status `unknown` | An item ID that Blizzard answers as not found. Shown as "Unknown item" with its ID and no icon. The system admin may save such an ID (REQ-0030, ADR 0029). Avoid: missing item, invalid item, error |
| Name not available | the item status `unavailable` | An item whose name or icon Blizzard did not give (down, slow, or the API limit). Shown as "Item" with its ID and "Name not available", no icon. Not an error page. Avoid: error, failed, unknown (that is Unknown item) (REQ-0030, ADR 0029) |
| Role slot | `lobby_role_slots`, `roleSlots`, `slots` | The number of players a lobby allows in one game role, shown as "Tank 0/1". A copy of the game role in the lobby. Avoid: spot (spot means a place in the lobby total) |
| Seat box | Removed (ADR 0028 Amendment 2026-11-21, section 16.8). The lobby page keeps the player list and the role slots, with no box per seat. Do not use. Avoid: seat card, slot box, spot (spot means a place in the lobby total) |
| Flex (any game role) | `gameRoleId` null on `lobby_players`, `flexCount`, request field `flex: true` | A player who takes one spot of the lobby total without a role slot, shown as "Flex N". Avoid: any role, wildcard, fill |
| Seat | request fields `gameRoleId` or `flex: true` (create and join) | The choice a player makes when joining a lobby with game roles: one game role, or flex. Avoid: spot (spot means a place in the lobby total), slot (slot means a role slot) (ADR 0017) |
| Display name | `displayName` (on `UserRef`, `AuthUser`) | A person's name as shown in the app: the Discord name taken at login. Not editable in the app. Avoid: username, nickname |
| You page | `/profile` page, frontend `ProfilePage` | The logged-in user's own page with account settings, sections Account, Game roles, System admin and Log out (REQ-0020, REQ-0021). Avoid: profile settings, my page |
| Avatar | frontend `Avatar` (`ui/Avatar.tsx`); planned by ADR 0018: `hasAvatar` (on `UserRef`, `AuthUser`), table `user_avatars` (auth), `GET /api/users/{userId}/avatar` | A square with 4 px corners (`--radius-sm`) and the initials of a person's name in the heading font, decorative, next to the name (REQ-0029 item 10, ADR 0028 section 9 and Amendment 2026-11-21 section 16.8). This is what is shown now. ADR 0018 (Proposed) plans `PersonAvatar` for the Discord picture; it is not built. Never a group's picture, which stays initials. Avoid: photo, profile picture, round badge (ADR 0018) |
| Live update | `GET /api/live-updates` (server-sent events), event `groupChanged`, data = group ID | The signal that a group's lobbies changed, sent while the page is visible. The screen then loads its data again. The signal carries no lobby data. Avoid: push, real-time, socket, sync (REQ-0017, ADR 0019) |
| Group feed | `GET /api/groups/{groupId}/feed`, frontend "Group feed" | The recent feed events of one group, newest first: seven days, at most 20. Not the history of lobbies (F-020). Avoid: activity feed, timeline, history, log. Do not use the bare word "activity" (REQ-0018, ADR 0020) |
| Feed event | `group_events`, `FeedEvent`, `kind`: `lobby_created`, `player_joined`, `player_left`, `lobby_full` | One recorded event of the group feed. Recorded in the same transaction as the lobby change that caused it. Keeps the game, mode and named activity names of its lobby as they were then. Holds user IDs only. The frontend composes its text and label. Avoid: activity, notification, log entry (ADR 0020) |
| Icon | frontend only (`Icon`, `IconName`, `ui/Icon.tsx`) | The only way the frontend draws an icon. Names are the project's own and name an action or a state (e.g. `pencil`, `full`; ADR 0021 A8). Only `ui/Icon.tsx` imports the icon library. Avoid: glyph, svg icon, symbol (ADR 0021) |
| Tooltip | frontend only (`Tooltip`, `ui/Tooltip.tsx`, on Radix Tooltip) | Short text shown above an element on hover or keyboard focus. Used by `IconButton` only. Closed with Escape. Hidden on touch (coarse pointer), where the label is shown on the button instead. Avoid: hint, popup, title attribute (ADR 0021, amended by ADR 0023) |
| Popover | frontend only (`AnchoredPopover`, `ui/AnchoredPopover.tsx`, on Radix Popover) | A panel that opens beside its trigger when a person clicks or taps it, or presses Enter or Space on it. It holds text or simple content. Closed with Escape or a click outside, and focus returns to the trigger. Used by the Game chip only (REQ-0021 Amendment 2026-11-17, ADR 0023 Amendment 2026-11-17). Not a Tooltip (it opens on click, not hover, and is not the name of its trigger) and not a Confirm dialog (no scrim, no modal). Avoid: bubble, flyout, pop-up, hint, dropdown (a dropdown list is a Dropdown list) |
| Create frame | frontend only (`CreateFrame`, `ui/CreateFrame.tsx`, renamed from `ui/Popover.tsx`; CSS classes `create-popover*` unchanged) | The panel that a create form grows out of, from the "+" or the button that opened it, with a scrim. Hand-built and not anchored, so it is not a Popover (ADR 0023 Amendment 2026-11-17). Avoid: popover, modal, dialog |
| Confirm dialog | frontend only (`ConfirmDialog`, `ui/ConfirmDialog.tsx` on `ui/Dialog.tsx`, Radix AlertDialog; props `onConfirm`, `onClose(confirmed)`, `toMessage`) | A panel with a scrim that asks a person to confirm one action: remove, leave, delete, make admin, change mode. Keep gets focus first. Keep or Escape closes it; a click outside does nothing; neither closes it while the action runs. The action calls `onConfirm`: a refusal stays in the dialog and is shown there, a success closes it. The owner acts in `onClose`, after the exit, and only when `confirmed` is `true`. Above the tab bar, popovers and dropdown lists (`--z-dialog`), below the toaster. Avoid: modal (the Create frame has a scrim too), popup, alert, prompt, confirm box, message box. The bare word "dialog" means this term only (ADR 0023 Amendment 2026-11-19) |
| Button variant | `Button` and `ButtonLink` (`ui/Button.tsx`), prop `variant`: `primary`, `secondary`, `ghost`, `danger` | The colour style of a text button. One variant per button. One size per pointer type. Destructive actions are always `danger`, with visible text. Avoid: button type, kind, style, `.button` classes (ADR 0021, ADR 0023) |
| Icon-only button | `IconButton` (`ui/IconButton.tsx`), built on `Button` with `variant="ghost"` and `size="icon"` | A ghost button with an Icon and a label. Mouse and keyboard: the Icon alone, with the label as Tooltip. Touch: the Icon with the label beside it. Its accessible name is the label, plus the subject when given. For secondary actions only (edit, copy). Avoid: icon button, round button (ADR 0021, ADR 0023) |
| Button link | `ButtonLink` (`ui/Button.tsx`), prop `variant` as on `Button`, prop `href` | A `Button` look on an `a`, for a control whose only job is to open a URL (the Discord login). Same slot, variant, classes and motion as `Button`; no `size`. A control that runs an action uses `Button`. Avoid: link button, anchor button, `a.button` (ADR 0023 Amendment 2026-11-19) |
| Toast | frontend only (`showToast`, `Toaster`, `ui/Toast.tsx`) | A short message in the toast region that confirms a successful action (the nine places of REQ-0022). It fades out after `TOAST_DURATION_MS` (4 s), and its timer pauses while the pointer is over it or keyboard focus is in the toast region. It replaces the inline status of that action, never both. Never for errors. No action button, link or undo. Callers pass translated text (ADR 0013). Avoid: snackbar, popup, flash message (ADR 0023, REQ-0022) |
| Toast region | frontend only (the `Toaster`, `ui/Toast.tsx`) | The place where toasts appear: the bottom-right corner, above the floating "+" on phones and never over the tab bar. Shown above an open Confirm dialog and popovers. Holds toasts only. Avoid: toast container, toast area, notification area (REQ-0022, ADR 0023) |
| Dropdown list | `Select` (`frontend/src/ui/Select.tsx`, on Radix Select, ADR 0027) | A control where a person picks one value from a list that opens over the page. The six lists of REQ-0027: the two game choices (create lobby, and the open lobby's settings), mode, activity, genre and max uses. Closed: its value and a chevron, with the look of a text field. Open: a panel of options, the selected one with a check mark. Not a date or time input, text field or checkbox. Avoid: select box, stock dropdown, combo box, drop-down, picker, native select (for the UI; the browser's own select is not used) (REQ-0027, ADR 0027) |
| Bottom sheet | frontend only (no component of its own: the panel of a Dropdown list on phones, rules in `global.css`) | The panel of a Dropdown list on a phone (window under 760 px, or a touch pointer): full width from the bottom edge, rows at least 44 px high, above the tab bar. Avoid: drawer, action sheet, modal sheet (REQ-0027, ADR 0027) |
| Game choice | frontend only | The Dropdown list of games: in the create lobby form, and in the lobby settings of an open lobby. Rows show the game logo or monogram and its name, then "Other" or "no game" (REQ-0009, REQ-0026, REQ-0027). Avoid: game picker, game dropdown, game select, game list (the game list is the admin's list of games, REQ-0010) |
| Design token | frontend only (`--color-*`, `--font-*`, `--space-*`, `--size-*`, `--duration-*`, `--ease-*` in `:root` of `styles/global.css`) | The only place with colour, font, spacing, size and motion values. Components use the token, never a literal value. Radius tokens are `--radius` (8 px) and `--radius-sm` (4 px) only. There is no shadow token (ADR 0028, Amendment 2026-11-21 section 16). Tailwind utilities in `ui/` read the token as `(--token)` (ADR 0023) |
| Stage | frontend only (the one theme of the app, ADR 0028 section 16) | The dark theme: a warm charcoal ground with the signal colour (orange) and the colour roles below. Dark only for now; a light theme may come later with the same token names. Avoid: dark mode, night mode, light theme |
| Colour role | frontend only (`--color-*` tokens in `:root` of `styles/global.css`, ADR 0028 section 16.2) | A named use of a colour token. Components use the role, never a hex value. `ground`: page background. `surface`: panels, the Next up band, dialogs, text fields. `raised`: hover, the highlighted option, avatars, toasts. `rule`: dividers only (a meter track is `raised`). `rule-strong`: decorative panel edges, never a control. `control-line`: the border of a control (text field, Dropdown trigger, secondary button), at least 3:1. `text`: text, icons, focus, fills of selected controls and meters. `muted`: secondary text. `scrim`: backdrop of the Create frame and dialog. `signal`: the Orange rule only. `on-signal`: text on the signal fill. `on-group`: text on a group colour. `danger`: danger text and border. `group-1` to `group-6`: group colour. Avoid: ink, colour names in components |
| Gold rule | frontend only | Superseded by the Orange rule (REQ-0029, ADR 0028). The gold token is removed. Do not use. |
| Orange rule | frontend only (`--color-signal`, `#ff6a2b`; the accent colour is open, so only this token's value may change) | The closed list of signal uses (ADR 0028 Amendment 2026-11-21, section 16.4): the Top bar background, the primary button fill, the Now line and the marker of today, the "Next up" eyebrow and countdown as text on the Next up band (the only signal text), the active tab, a full role slot (with its check icon), and my own avatar in a player list. Signal is never text anywhere else. Focus is the text colour, never signal; inside the Top bar it is the on-signal colour (ADR 0028 section 16.11). Replaces the Gold rule (REQ-0029 item 1a). Avoid: gold, accent, highlight |
| Signature detail | frontend only | One effect added to one page to make it recognisable. At most two per page; compositor-only motion; marked `signature: <page>` in the code (ADR 0023). Home: the running order track and its Now line (REQ-0029 item 13, ADR 0028). Avoid: effect, animation, flourish, hero motion, wow feature |

Notes:
- "Time" in the sense of a clock time or timestamp is "time" (`startsAt`, `endsAt`, time zone). Only the bookable slot is a "lobby".

**Error codes** (renamed from the Swedish-era codes, all others unchanged):

| Old | New |
|---|---|
| `time_in_past` | `lobby_in_past` |
| `time_end_not_after_start` | `lobby_end_not_after_start` |
| `time_too_long` | `lobby_too_long` |
| `time_has_ended` | `lobby_has_ended` |
| `time_full` | `lobby_full` |
| `time_not_found` | `lobby_not_found` |
| `own_upcoming_times_exist` | `own_upcoming_lobbies_exist` |

**Status words:**
- ADR: `Proposed` / `Accepted` (keep the date).
- Architect and product handover: `DONE` / `BLOCKED` / `PARTIAL` / `ESCALATE`.
- Review result: `APPROVED` / `NOT APPROVED`.
- Review level: `BLOCKER` / `SHOULD` / `COULD`.
- Markers in documents: `ASSUMPTION` / `DECISION`. "Amendment 2026-11-01" is written as "Amendment 2026-11-01".
- Requirement status: `Draft` / `Decided` / `Implemented` / `Rejected`. Feature status: `Proposed` / `Decided` / `In progress` / `Done` / `Removed`. Priority: `Must` / `Should` / `Could`. Product owner verdict: `NEW` / `EXTEND F-NNN` / `DUPLICATE OF F-NNN` / `REJECTED` / `NEEDS ANSWER`.

## Model selection

Agents use the weakest model that can handle the task. Each task starts at step 1 (UI and backend tasks at step 3, see below) and moves up one step at a time only when needed.

| Step | Model | Effort | Used |
|---|---|---|---|
| 1 | Haiku (`haiku`) | medium | Always first (except UI and backend tasks) |
| 2 | Sonnet (`sonnet`) | medium | After escalation from step 1 |
| 3 | Opus 5.5 (`opus`) | medium | After escalation from step 2, and the start step for UI and backend tasks. **Highest allowed level.** |

- Agent files have `model: haiku` and `effort: medium` by default. Exception: `ui-ux-expert.md` and `backend-expert.md` have `model: opus`.
- **UI and backend tasks start at step 3.** Tasks for the UI/UX expert and the backend expert start at `opus`, because `haiku` work there needed two or more review rounds almost every time, and the ADR 0017 slices at `sonnet` needed escalation to `opus` after two rejections (PR3b, PR5a, PR5b; decided by the user 2026-11-11). There is no step above, so a rejection twice at step 3 means the orchestrator stops and asks the user.
- Effort is never higher than `medium`. Models above Opus 5.5 (e.g. Fable or Mythos) and effort `high` or higher are never used.
- **Escalation** happens when:
  - the agent itself returns `Status: ESCALATE` with a reason (it cannot handle the task or cannot judge it safely), or
  - the result is rejected by the reviewer or by tests twice at the same step, or
  - the orchestrator judges that the result clearly does not meet the bar.
- The orchestrator then reruns the same task with the next model (the `model` parameter when starting the agent) and gives it the previous agent's result and problems as context.
- Never skip a step when escalating. If step 3 fails, the orchestrator stops and asks the user.
- The next task starts at step 1 again (step 3 for UI and backend tasks), including for the same agent.
- The main session (orchestrator) also runs on at most Opus 5.5 with effort medium. It is selected in the session with `/model` and `/effort`.
- Use the model names (`haiku`, `sonnet`, `opus`) in agent files. Check in Claude Code that they point to the versions you want.

## Stack

Agents build on this and do not choose their own frameworks. A deviation requires an ADR approved by the architect.

- **Architecture:** microservices behind an API gateway
- **Backend:** Go (latest stable version). Standard library first.
- **Frontend:** React + TypeScript (Vite). Another tool only if React cannot solve the need, and then with an ADR that justifies why. Styling is plain CSS with the design tokens in `frontend/src/styles/global.css`. shadcn/ui components are copied into `frontend/src/ui/` and styled with Tailwind utilities that read the tokens. Radix primitives (alert dialog, tooltip, dropdown menu, popover, select) and sonner (toasts) are used only inside `frontend/src/ui/`. No other component kit. Frontend dependencies added from ADR 0023 on have exact version pins; the existing ranges in `frontend/package.json` stay (ADR 0023).
- **Login:** Discord OAuth2. Other login methods only if Discord does not suffice for a concrete requirement.
- **Database:** PostgreSQL, one database (or schema) per service
- **Operations:** Docker / Docker Compose on Raspberry Pi 5 8GB
- **CI:** GitHub Actions

## Skills first

Before an agent solves a task itself, it checks whether a suitable skill exists (list the available skills; in Claude Code via `/skills` or the skill list in the session). If one fits, it must be used and its instructions followed.

- **ponytail** is used whenever code is written, to keep the amount of code as small as possible.
- Other skills are used when they match the task (e.g. frontend-design for UI, a skill for document formats, testing, security).
- If a skill conflicts with `CLAUDE.md`, `CLAUDE.md` wins. Flag the conflict to the architect.
- The handover states which skills were used.

## Microservices

- **One service = one bounded capability** (bounded context), not a technical layer. "users-service" and "db-service" are the wrong split.
- **Start with few services.** Split when a boundary is clear and justified (different pace of change, ownership, scaling needs). Each new service requires an ADR. Better one service too few than one too many.
- **Starting set:** `gateway` (routing, session validation) and `auth` (Discord OAuth, sessions). Domain services are added as needed.
- **Own data:** a service reads and writes only its own database. No service reads another service's tables directly.
- **Communication:** synchronous via HTTP/JSON with contracts in `api/`. Asynchronous events (queue/broker) only when a concrete need exists, and then with an ADR.
- **Contract first:** API contracts (OpenAPI) live in `api/<service>/` and are the source for types in both Go and TypeScript. Contracts are generated, not written by hand twice.
- **Shared code** in `pkg/` only for pure infrastructure (logging, configuration, HTTP middleware). No shared domain logic between services, because that couples them.
- **Independent deployment:** each service is built, tested and deployed on its own.
- **One service = one container.** Each microservice has its own `Dockerfile` and runs in its own container with one process. The frontend and PostgreSQL also run in their own containers; a service never embeds another service or its database in the same container.
- **Containers are stateless and replaceable.** All configuration comes from environment variables, logs go to stdout, and no state is saved in the container's filesystem. A container must be able to be stopped, restarted or run in several instances without data loss.
- **Each service can run alone.** `docker compose up <service>` starts the service with only the dependencies it needs. Services find each other via service names and addresses from environment variables, never via hard-coded host names or `localhost`.
- Each service has `/healthz` and `/readyz`, structured logging and a correlation ID that is passed on in all calls.

### Directory structure

```
api/<service>/openapi.yaml       contract
services/<service>/
  cmd/<service>/main.go          startup and wiring of dependencies
  internal/                      transport, application, domain, infrastructure
  migrations/                    the service's own migrations
  Dockerfile                     the service's own image
pkg/                             shared infrastructure code (not domain)
frontend/                        React app
infra/                           compose, operations configuration
docs/adr/                        architecture decisions
docs/services.md                 service map: responsibility, owned data, dependencies
docs/product/                    vision, feature register, backlog, requirements
docs/design/                     reference design mockups (static HTML, not app code; UI/UX expert)
```

## Code principles

These apply to all code in the project. The architect interprets them in case of disagreement.

### Minimal code
- The best code is the code that does not need to be written. Use the standard library, existing code and skills (ponytail) before writing something new.
- No layers, abstractions or configuration options that no requirement needs.

### SOLID
- **S: Single Responsibility**: a module, type or function has one reason to change. Do not mix HTTP handling, business logic and database access in the same unit. At service level: a service has one responsibility.
- **O: Open/Closed**: extend behavior through new implementations, not by adding `if` branches to existing code.
- **L: Liskov Substitution**: an implementation of an interface can be swapped out without the caller noticing a difference in the contract (including error behavior).
- **I: Interface Segregation**: small, focused interfaces defined where they are *used*, not where they are implemented (idiomatic in Go).
- **D: Dependency Inversion**: domain logic depends on abstractions. Concrete dependencies (database, external APIs, clock) are injected in `main.go`. See the section on modularity below.

### DRY
- Knowledge has a single authoritative place: validation rules, constants, types, configuration, API contracts.
- Duplicate twice rather than abstract too early. At the third occurrence: extract (*Rule of Three*).
- DRY applies to knowledge, not to code that happens to look alike. Between services some duplication is acceptable, because it is better than coupling them.

### Also
- **KISS**: the simplest solution that meets the requirement wins.
- **YAGNI**: do not build for hypothetical future needs.
- **Separation of concerns**: layers within a service: transport → application → domain ← infrastructure. The domain never imports from infrastructure.
- **Fail fast**: validate at system boundaries, trust data inside.

## Modularity and vendor independence

Code must be clearly separated and must not be bound to specific vendors, libraries or frameworks. Each external dependency must be replaceable by writing a new adapter, without touching domain or application code.

### Ports and adapters
- **Port:** an interface that describes what the code needs, in the domain's own language (e.g. `IdentityProvider`, `UserRepository`, `Clock`). The port is defined in the layer that uses it.
- **Adapter:** an implementation of the port against a specific technology (e.g. `discordIdentityProvider`, `postgresUserRepository`). Adapters live in `infrastructure/`.
- The connection between port and adapter is made in one place only: in `main.go` for Go, and in a provider / composition root for the frontend.

### Where interfaces are used
Interfaces are used **at boundaries**, not everywhere:
- toward all external systems: identity provider (Discord), database, other services, email, storage, queues
- toward things that make code hard to test: time, randomness, filesystem, environment
- between modules that must be able to change independently

Interfaces are **not** used for pure domain logic with a single implementation and no external dependency. An interface with one implementation and no boundary to protect is unnecessary code.

### Rules
- **No vendor types leak.** Types from Discord, `pgx`, HTTP frameworks or UI libraries may only appear in the adapter. The port uses the project's own types (e.g. `ExternalIdentity{Provider, SubjectID, DisplayName}` instead of a Discord user).
- **No provider names in the domain.** Domain and application code never mentions Discord, Postgres or similar. The data model stores e.g. `provider` + `provider_subject_id` instead of `discord_id`, so that more login providers can be added without a schema change.
- **One new dependency = one adapter.** A new library or a new external service is introduced behind a port, not directly in domain or application code.
- **Replacement stays local.** The test question: if we change provider, does only the adapter and the wiring in `main.go` change? If the answer is no, the separation is wrong.
- **Standards before vendors.** Use open standards and formats where possible: OAuth2/OIDC, SQL without vendor-specific features when not needed, OpenAPI, OCI images, OpenTelemetry-compatible logging and metrics.
- **Modules have clear public surfaces.** In Go the implementation lives in `internal/` and only what is needed is exported. In the frontend each module exports through its own index and does not import other modules' internal files.

## Code standard

- Names describe *what*, not *how*. No abbreviations beyond established ones (`id`, `url`, `db`, `ctx`).
- Functions are kept short (guideline: under 30 lines) and at one level of abstraction. For React components whose length is mostly JSX markup, the guideline is a `COULD` in review, never a `SHOULD` or `BLOCKER`; it stays a `SHOULD` for logic, hooks and Go code.
- No magic numbers or strings; use named constants.
- Comments explain *why*, not *what*.
- Errors are handled explicitly; no silent `catch` and no ignored `err`. Log with context and never expose internal details to the client.
  - **Expected browser refusals** are the one exception to "log with context". A `catch` around a browser API that the user's browser may refuse (`localStorage`, `navigator.clipboard`) is explicit handling when all of these hold:
    1. the `try` covers only that call, or the property access that can throw;
    2. the catch returns a fallback that the requirement describes, and a one-line comment in the catch names the fallback and cites the requirement (e.g. `REQ-0012`);
    3. a test makes the browser refuse and asserts the fallback.
  - Such refusals are not logged: the fallback is the expected outcome and nobody can act on it. A catch whose comment only says "nothing to report" does not qualify, because the fallback is not named.
  - API and network errors are never covered by this exception. They are converted to a typed error and rethrown, or shown to the user (see `frontend/src/api/httpApiClient.ts`). A catch that returns a default for an error nobody named is a `BLOCKER`.
  - If the team later needs refusal rates, the architect adds one shared `reportError` (ADR). Until then there is none (YAGNI).
- No dead code, commented-out code, or TODO without an issue reference.
- Linters and formatters are authoritative (`gofmt`, `golangci-lint`, ESLint, Prettier).

## Tests

- Every change of behavior has tests. A bug fix starts with a test that reproduces the bug.
- Test pyramid: many unit tests on domain logic, fewer integration tests against a real database, few end-to-end tests.
- Contract tests between services: a service that calls another is tested against the contract in `api/`.
- Tests depend on interfaces, not implementations.

## Workflow

1. **The product owner** decides whether and why something should be built, checks that the functionality does not already exist, and writes the requirement with acceptance criteria.
2. **The orchestrator** breaks the requirement down into sub-tasks and states which skills are relevant.
3. **The architect** reviews the plan if it touches service boundaries, new services, new dependencies, the data model or API contracts. Decisions are documented as ADRs. If the plan touches none of these, the architect is skipped and the specialists start directly.
4. **The specialists** implement within their areas, with relevant skills and tests.
5. **The reviewer** reviews all changed code strictly against the architecture and code principles. Findings are classified: `BLOCKER` / `SHOULD` / `COULD`. The review happens **once per requirement**, on the whole change after all sub-tasks are done, not after each sub-task. On `NOT APPROVED` the task goes back to the owning agent and is reviewed again after the fix. If a rule is unclear, the architect decides. **Docs-only changes** (no code, contract or config) are `APPROVED` when there is no `BLOCKER`; `SHOULD` and `COULD` findings are recorded as follow-ups instead of blocking the change. An approved requirement may still be shipped as several small PRs.
6. **The orchestrator** checks the Definition of Done, and **the product owner** updates the status in the feature register.

Pure bug fixes and technical improvements without new functionality may go directly to step 2. No code skips step 5.

**Responsibility boundaries:**
- The product owner avoids duplicate *functionality* (the same need solved twice).
- The architect designs and owns the rules, and avoids duplicate *code* (the same knowledge in several places).
- The reviewer checks that the rules are followed, but does not change rules or code.

## Definition of Done

- [ ] The acceptance criteria in the requirement are met
- [ ] The feature register (`docs/product/features.md`) is up to date
- [ ] Relevant skills have been used
- [ ] Tests written and green locally and in CI
- [ ] Lint and type checks without errors
- [ ] The reviewer has given `APPROVED` (no `BLOCKER`, every `SHOULD` fixed or justified; for docs-only changes, no `BLOCKER`)
- [ ] No secrets in the code
- [ ] Migrations are reversible or have a documented rollback plan
- [ ] API contracts, `docs/services.md` and ADRs updated where something changed

## Handover format

When an agent hands work back to the orchestrator:

```
## Result: <task>
Status: DONE | BLOCKED | PARTIAL | ESCALATE
Model: <haiku | sonnet | opus>
Escalation reason: <only for ESCALATE: what did not work and why>
Service(s): <affected services>
Changed files: <list>
Skills used: <list>
Tests: <what was added / run>
Decisions needing ADR: <yes/no + short>
Dependencies on other agents: <what is needed, from whom>
Open questions: <list>
```

## Security (applies to everyone)

- Secrets only via environment variables or a secret store, never in the repository.
- All external input is validated at the boundary.
- Least privilege for services, database roles and CI tokens.
- Internal services are not exposed publicly; all external traffic goes through the gateway.
- Identity and role reach the services only as `X-User-*` headers set by the gateway. The gateway removes the client's `X-User-*` on all routes. Services trust these headers and no other header for identity or role (ADR 0002, 0011). Roles in a service are checked in `application`, never only in the UI.
