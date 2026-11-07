# REQ-0014. Game genre themes
Status: Decided
Feature: F-032
Priority: Should

Decided by the user (DECISION, user, 2026-11-07): genre themes, chosen from three options (where, how, which games). The product owner wrote the criteria. The data model, the API and the design of the themes are the architect's and the UI/UX expert's.

## Problem
Every lobby looks the same, whether it is a shooter or a board game night. A member cannot tell the kind of game at a glance, and the app does not feel like a gaming app. The user wants the look of each lobby to relate to the game chosen. Real logos and cover art are not an option, because of trademark risk.

## User story
As a member, I want each lobby to look like the kind of game it is for, so that I recognize the game at a glance and the app feels like a gaming app.

## Acceptance criteria

Genre on a game (extends REQ-0010, see Related features):
- Given that I am a system admin, when I add or change a game, then the form lets me choose one genre from the fixed list or "No genre" (DECISION, user, 2026-11-07: the list is Shooter, MOBA, Racing, Strategy, Survival, Party, RPG and Sports).
- Given that I am a system admin, when I save a game with a genre, then the genre is saved with the game and shown in the game list.
- Given that I am a system admin, when I change a game's genre and save, then every lobby of that game shows the new genre's theme at the next view (ASSUMPTION: the theme follows the game, not the lobby).
- Given that I am a system admin, when I choose "No genre" for a game and save, then the game has no genre and its lobbies show the neutral theme.
- Given that I am a system admin, when I save a genre that is not in the fixed list, then it is denied with an error message and no change is saved.
- Given that I am not a system admin, when I try to set, change or clear a genre, then it is denied and the game list is not changed. The check is made in the service, not only by hiding the control in the UI (CLAUDE.md, security: roles are checked in the service).
- Given that a game is removed (REQ-0010), when I see its lobbies, then they keep their game name and show the neutral theme, because no genre is left to show.
- Given that the genre feature is delivered, when I look at games that were in the game list before, then each has "No genre" and shows the neutral theme. No game, lobby or name changes in the process.

Themed views:
- Given that a lobby has a game with a genre, when I see it in a lobby list (REQ-0004), on the dashboard under Next up or This week (REQ-0012), on the lobby page, or as a block in the week calendar (REQ-0004, time grid), then the lobby shows the theme of that genre: its accent color, background pattern, icon and 3D motif, as defined in the Genre themes table below.
- Given that a lobby has "Other" (customGameName), or a game with "No genre", when I see it in any of these views, then it shows the neutral theme and no genre theme.
- Given that two genres are shown in the same view, when I compare their cards, then their accent colors and icons differ, so the genres can be told apart without reading.

Genre themes (each genre has all four parts; the exact visuals are designed by the UI/UX expert under the rules below):
- Given any genre theme, when it is shown, then it consists of an accent color, a background pattern, an icon and a 3D motif. The neutral theme has the same four parts, with a neutral color, a plain pattern and a generic icon.
- Given the genre list, when I compare the themes, then each genre has a different accent color and a different icon from every other genre, including the neutral theme.
- Given the 3D motif is shown in a lobby view, then it is a static image in the app. Only the landing hero (REQ-0013) moves it.
- Given any genre theme, when I check where its 3D motif is defined, then it is defined once, as part of that genre's theme. The landing hero (REQ-0013) renders the motif of the theme it shows and has no motif of its own.

Meaning without color (WCAG 1.4.1):
- Given any themed view, when I cannot see the colors, then the game name is shown as text, and the genre name is shown as text in lobby lists, on the dashboard and on the lobby page. The icon and the genre name carry the meaning, not the color alone.
- Given a lobby with the neutral theme (no genre, or "Other"), when I see it, then no genre name is shown, because there is no genre. The game name, which is always shown as text, and the generic neutral icon carry the meaning. This is accepted under WCAG 1.4.1: no meaning rests on color, and the icon is decorative (`aria-hidden`), so the game name is the text that identifies the lobby.
- Given a themed view in a week calendar block that is too small for the genre name, when I see the block, then the game name is still shown as text (it already is in REQ-0004).

Contrast (WCAG AA):
- Given any genre theme or the neutral theme, when I check the text on its background (game name, genre name, time, "X/Y players"), then the contrast is at least 4.5:1, or 3:1 for large text as WCAG defines it, as all text in the app.
- Given any genre theme or the neutral theme, when I check the accent color against its background where it carries meaning (icon, meter fill, border), then the contrast is at least 3:1 (WCAG 1.4.11).

Motion:
- Given that I have reduced motion on (`prefers-reduced-motion: reduce`), when a themed view is shown, then no theme moves: any motion of a pattern, icon or motif is off and the static version is shown.

Brands and content:
- Given any genre theme, when I review its assets, then it contains no game logo, game title, cover art, character or other trademarked element. Only the project's own shapes, patterns and icons are used.
- Given the genre names, when the UI is translated (cross-cutting note in features.md), then the genre names come from the UI text catalog and can be translated. They are not stored data.

Landing hero (extends REQ-0013):
- Given that I am logged out and open `/`, when the hero shows its sample cards, then each sample card uses one of these genre themes, and each sample card uses a different genre (REQ-0013 amendment 2026-11-07).

## Genre themes

| Genre | Meaning of the theme (the design is the UI/UX expert's) |
|---|---|
| Shooter | Sharp angles, crosshair-like pattern, icon of a target |
| MOBA | Map-like lanes pattern, icon of a shield or tower |
| Racing | Speed lines pattern, icon of a wheel or flag |
| Strategy | Grid pattern, icon of a chess piece |
| Survival | Rough terrain pattern, icon of a flame or tent |
| Party | Dots and confetti pattern, icon of a balloon or dice |
| RPG | Ornate frame pattern, icon of a sword or scroll |
| Sports | Pitch-line pattern, icon of a ball |
| Neutral (no genre, Other) | Plain background, generic pin icon |

The table is the intent. The exact colors and motif shapes are a design decision of the UI/UX expert and must meet the rules above.

## Out of scope
- Real game logos, cover art, characters, titles or any trademarked element (see F-030 for the logo part of game presentation, which stays separate).
- Per-game colors or images. The genre gives the default look; a per-game accent color from F-030 overrides it when F-030 is built (see Related features).
- More than one genre per game.
- Genres that are not in the fixed list, or genres typed in by anyone.
- A theme chosen by the lobby creator or by a member, or a personal theme preference.
- A theme in the create-lobby form (REQ-0003). The form shows the game name only, as today. Could be a later requirement.
- Continuous animation of themes in the app (the landing hero only, REQ-0013).
- Sound.
- Changing the game roles or game list fields beyond the genre (REQ-0011 and REQ-0009 stay as they are).

## Related features
F-024 and F-025 (game list and its management, REQ-0009, REQ-0010): the genre is a new field per game, which REQ-0009 excludes. This requirement lifts that exclusion for the genre only, the same way REQ-0011 lifts it for game roles. REQ-0009 is amended in this same change (Amendment 2026-11-07), so the genre field and its rules ship together. The genre is entered in the form of F-025; this is not a second place to manage games.

F-030 (Game presentation: logo and accent color, REQ-0009 amendment): both parts stay. The genre theme gives the default accent color per genre. When F-030 is built, its per-game accent color overrides the genre theme's accent color for that game (DECISION, user, 2026-11-07). This requirement does not build the per-game color. It is not a duplicate of F-030, because F-030 gives a color per game and the logo, and this gives a look per genre.

F-004, F-017, F-028 (lobby lists, week calendar, dashboard) and F-005 (join and leave): these views are where the theme shows. This requirement changes only their look for a lobby, not their behavior. It is presentation of those features, not a new feature in them.

F-027 (Game roles and role slots, REQ-0011): game roles describe how many players a team needs per role. A genre describes the look of a game. Different needs, no overlap.

REQ-0013 (Landing hero): the hero's sample cards use the genre themes of this requirement. The hero stays decorative and shows no real data.

## Open questions
- DECISION (user, 2026-11-07, genre list): Shooter, MOBA, Racing, Strategy, Survival, Party, RPG and Sports, plus "No genre". A new genre is a new theme to design, so the list stays short.
- ASSUMPTION (one genre per game): a game has at most one genre.
- ASSUMPTION (follows the game): a genre change applies to all lobbies of the game at the next view, because the theme follows the game, not the lobby.
- DECISION (user, 2026-11-07, F-030 color override): F-030 keeps both parts. The per-game accent color of F-030, when built, overrides the genre theme's accent color for that game. The genre theme is the default. Not built in this requirement.
- ASSUMPTION (priority): Should. The user asked for it now, so it is placed first among the Should items in backlog.md. The user may move it ahead of the other items at any time.
- For the architect (not decided here): the storage and API of the genre (a field on the game, a fixed list as a database enum or a constant list), how the genre reaches the lobby views, and the new terms for the glossary: **Genre** (`genre`: a fixed-list category of a game, one per game, optional, e.g. "Shooter") and **Genre theme** (the look of a genre: accent color, pattern, icon and 3D motif; a neutral genre theme for lobbies without a genre). These terms are not added to CLAUDE.md by the product owner; the architect owns that file.
- For the UI/UX expert (not decided here): the exact colors, patterns, icons and motifs in the table, under the contrast and motion rules.
