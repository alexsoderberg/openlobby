# Dashboard and app navigation: design

Date: 2026-11-04. Status: approved by the user in the sketch session (mockup: `mockups/2026-11-04-dashboard.html`, toggle Desktop/Phone at the top right).
Builds on: `2026-11-03-dark-luxury-ui-design.md` (tokens, fonts, motion). Feeds: REQ-0012 (F-028, dashboard and app shell). Terms follow the glossary in `CLAUDE.md`.

The mockup is illustrative. REQ-0012 and ADR 0014 are normative; where they differ, they win.

## Intent

After login the user lands on one home, the **dashboard**, that answers "what are we playing, and when?" across all their groups. Group pages live inside the same shell instead of being separate pages. The app must be excellent on phones: **mobile first**, desktop is the enhanced layout.

## Decided by the user

- **Dashboard is the home** after login. It shows a large **"Next up" card** (the lobby that starts first among all lobbies of the user's groups, running lobbies included: time, countdown "starts in 1 h 42 min" or Running, game, group, Spot / max players) and below it **This week** across all groups. The card has no "Join lobby" or "Leave lobby" buttons and no player names until REQ-0005; they are added with REQ-0005 and `joinedByMe` (ADR 0014). **This week** lists lobbies that have not ended yet and whose time overlaps Monday–Sunday of the current week, including lobbies that started before Monday and are still running (shown in Monday's column on desktop); the Next up lobby is also listed.
- **Group view inside the shell.** Selecting a group shows its lobbies, members and invite links in the main area. `/groups/{groupId}` stays the URL.
- **Full wordmark always visible.** "OpenLobby" sits in a top bar; it must never look like a group icon.
- **Home control is a house icon**, at the top of the group rail (desktop) and the "Home" tab (mobile). It opens the dashboard.
- **Create group lives behind a "+".** The "+" is drawn from two centered bars and turns into "×" when open. The form grows out of the **exact center of the pressed "+"** and shrinks back into it on close (Esc, Cancel or tapping outside closes it).
- **"+" motion (accepted for the MVP):** one continuous motion per property, no keyframe stops. Open: `transform: scale(.08 → 1)` from the "+" center, 0.62 s, `cubic-bezier(.3,1.35,.5,1)` (slight overshoot gives the blob feel); opacity in 0.14 s. Close: scale back, 0.38 s, `cubic-bezier(.55,0,.75,0)`. Only `transform` and `opacity` animate (compositor only). The form's contents fade in after the shape, staggered. Durations and curves become tokens in `global.css`.
- **Mobile layout (default, < 760 px wide):**
  - top bar with wordmark and own avatar;
  - horizontally swipeable **group strip** at the top of the dashboard;
  - **bottom tab bar**: Home, Groups, a large gold "+" (thumb reach), You (DECISION, user, 2026-11-04: four equal columns); respects `env(safe-area-inset-bottom)`. DECISION (user, 2026-11-04): no Calendar tab (Home already shows the week). Groups = group list (`/groups`); You = `/profile` with name, avatar, Log out and, for system admins, a Game list link;
  - week as a **row of 7 day pills** (dot = has lobbies) with that day's lobbies as an **agenda** below;
  - touch targets at least 44 px; inputs use 16 px text (no iOS zoom).
- **Desktop layout (≥ 760 px):** top bar, **group rail** on the left (house, separator, round group icons that become rounded squares on hover/active with a gold marker, "+" at the bottom), full **7-day week grid** in the main area. Same content as mobile.

- **"+" creates a group only** in the MVP (DECISION, user, 2026-11-04); lobbies get their own button in the group view.
- **Dashboard is MVP, Must** (DECISION, user, 2026-11-04). Requirement: REQ-0012 (F-028).

## Not in the dashboard requirement

Decided separately, not part of REQ-0012:
- **Discord avatars** for users: F-029 (after the MVP; the MVP shows initials).
- **Game accent color** in tags, calendar entries and the "Next up" card glow: F-030 (later).
- Loading and error states of the dashboard follow REQ-0012 and ADR 0014 point 4: page-level error with retry, no toasts.

## Vocabulary (UI terms)

Layout and control names used in this spec and the mockup. They are not domain terms and are not in the glossary in `CLAUDE.md`. Domain terms (Dashboard, Next up, This week, Running, Ended, Group list, Group view, Spot / max players) are in the glossary.

| UI term | Component | Meaning |
|---|---|---|
| App shell | `AppShell` | The layout of all logged-in pages: top bar, group rail or tab bar, and main area |
| Top bar | `TopBar` | Top of every logged-in page: the wordmark and the own avatar with display name. On wide screens the avatar opens the profile menu |
| Wordmark | text "OpenLobby" | The full app name in the top bar. Never shown as a group icon |
| Group rail | `GroupRail` | Left navigation on screens 760 px and wider: Home, group icons, "+" |
| Group strip | `GroupStrip` | Horizontally swipeable row of group icons at the top of the dashboard on phones |
| Tab bar | `TabBar` | Bottom navigation on phones (under 760 px): Home, Groups, "+", You. Respects the bottom safe area |
| Home | house icon | The control that opens the dashboard. A label and icon, not a second screen |
| You | `/profile` | The You tab on phones: display name, avatar, Log out and, for system admins, Game list. On wide screens the same content is the profile menu |
| Create group button | `CreateGroupButton` | The "+" in the group rail or the tab bar. Creates a group only in the MVP (`POST /api/groups`). Lobbies are created in the group view |
| Create group form | `CreateGroupForm` | The form that grows out of the pressed "+". Closes with Esc, Cancel, "×" or a tap outside, and focus returns to the "+" |
| Group icon | `GroupIcon` | Round icon of a group with its initials, in the group rail and group strip. Its accessible name is the group name. Avatars also show initials (Discord pictures are F-029) |
| Day pill | `DayPill` | Phone: one of the seven day buttons (Monday to Sunday) under This week. A dot marks a day with lobbies |
| Agenda | `DayAgenda` | Phone: the list of the selected day's lobbies below the day pills |
| Countdown | text | The "starts in 1 h 42 min" text on Next up |

## Constraints

- Stack, tokens and motion rules from the 2026-11-03 spec still apply; reduced motion turns all motion off (the form then just appears).
- F-017 (MVP): list is the default calendar view and week view is the switch; month view is not in the MVP.
- No new frontend library: the morph and layout are plain CSS + React.
- i18n: all text translatable; dates and times per locale (cross-cutting note in `features.md`).

## Left to the builder

Component split, routing details, how the "+" origin is measured (bounding rects at open time in the sketch), focus management (focus the name field on open, return focus to the "+" on close), and the breakpoint token name.
