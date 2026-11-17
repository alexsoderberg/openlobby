# REQ-0026. Game logo and cover image
Status: Decided
Feature: F-030
Priority: Should (DECISION, user, 2026-11-15: starts now, before avatars (REQ-0016) and the rest of the backlog)
Architecture: ADR 0026 (storage in `calendar`, upload and removal per image, delivery behind the gateway)

## Problem
The user wants to start showing images for games: a wide image behind the Next up card, and a logo for each game. Today a game has a name, an optional genre and optional roles, but no image. The Next up card shows the genre theme (REQ-0014), which looks the same for every game of one genre. REQ-0014 excluded real logos and cover art for trademark reasons. On 2026-11-04 the user accepted the trademark risk for game logos in this private app (F-030), and on 2026-11-15 the user extended that acceptance to cover art. This requirement is the image part of F-030, with a cover image added.

## User story
As a member, I want each game to show its own logo and cover image on the Next up card, so that I recognize the game at a glance.

As a system admin, I want to add a logo and a cover image to a game in the game form, so that every lobby of that game gets the look once, without a new version.

## Terms
Game image (one image of a game, of kind logo or cover), game logo, game cover and monogram, as in the glossary of CLAUDE.md (ADR 0026). The label of a lobby stays text-only.

## Acceptance criteria

Setting the images (system admin, extends the game form of REQ-0010):
- Given that I am a system admin, when I change a game, or after I add it and save it once, then the form has an optional logo and an optional cover, each with a file choice and a "Remove image" action. A new game has no image field until its first save, because an image needs the game's ID (ADR 0026, point 8). DECISION, user, 2026-11-15: both optional, per game.
- Given that I choose a file for a logo or cover, when it is saved at once, then the image is stored by our system and the form shows it. DECISION, user, 2026-11-15 (ADR 0026, point 1): each image is saved when the file is chosen, not with the game save; saving the game does not carry images. Upload only: a web address pasted by the admin is not accepted (DECISION, user, 2026-11-15).
- Given that I choose a "Remove image" action for a logo or cover, when it is done, then that image is removed and the game shows the monogram or the genre theme as its fallback. DECISION, user, 2026-11-15 (ADR 0026, point 1).
- Given that I choose "Remove image", when I am asked to confirm in the existing confirmation dialog, then the image is removed only after I confirm, and cancelling leaves it unchanged. "Remove image" is a `danger` button with visible text, as for removing a game (REQ-0010). DECISION, orchestrator, 2026-11-15, following the destructive-action rule.
- Given that I choose a file whose type is not PNG, JPEG or WebP, when it is sent, then it is denied with an error message and the image is not changed (ASSUMPTION: type allowlist set here; GIF is not allowed; the architect may refine the limits).
- Given that I choose a file larger than 512 KiB, when it is sent, then it is denied with an error message and the image is not changed (ASSUMPTION: size limit set here; the architect may refine it).
- Given that a logo is saved for a game, when I view the game list, then the logo is shown next to the game name in the game list and in the game form (REQ-0010).
- Given that I am not a system admin, when I try to upload, change or remove an image, then the request is denied by the service, not only hidden in the UI (CLAUDE.md, security).
- Given that a game is removed (REQ-0010), when I see its lobbies, then they keep their game name and show no image, because the game and its images are gone.
- Given that a game was in the list before this feature, when I view it, then it has no images and shows as it does today; no game, lobby or name changes.

Showing the images (members):
- Given that I am logged in, when a lobby's game has a logo, and the lobby is shown on the Next up card (REQ-0012) or on its lobby page, then the logo is shown next to the game name at the size of Amendment 2026-11-16, and the name is still shown as text. DECISION, user, 2026-11-15: the logo appears in the game form, the game list, the Next up card and the lobby page, and in the game choice (Amendment 2026-11-16). Old wording: "at a fixed size"; "only" in the places list.
- Given that I am logged in, when a lobby's game has a cover, and the lobby is shown on the Next up card, then the cover replaces the genre background pattern of the card and fills it behind the card's content, cropped and not stretched (ASSUMPTION for the crop; the replacement is DECISION, user, 2026-11-15).
- Given that a cover is shown on the Next up card, when I look at it, then the genre accent border and the genre icon of REQ-0014 stay visible. DECISION, user, 2026-11-15.
- Given that a cover is shown on the Next up card, when I read the card's text (game name, time, "X/Y players", the Join and Leave buttons), then each text has a contrast of at least 4.5:1 against what is behind it, or 3:1 for large text, as WCAG defines it (the scrim on the cover is allowed). The check uses the lightest and the busiest cover of the test fixtures.
- Given that a game has no cover, when its lobby is shown on the Next up card, then the genre theme is shown as today (REQ-0014). DECISION, user, 2026-11-15.
- Given that a game has no logo, when a place shows its logo (the game form, the game list, the Next up card, the lobby page), then the monogram (the initials of the game name, F-030) is shown in its place. The monogram is a text-free shape, so the name stays the text that identifies the game.
- Given that a lobby's label is shown (Next up, This week, lobby list, lobby page), then the label stays text-only, with no logo or cover in it. DECISION, user, 2026-11-15.
- Given that a lobby is "Other" (customGameName) or an open lobby with no game (REQ-0015), when I see it, then it shows no logo and no cover, and the neutral theme of REQ-0014.
- Given that a game's image cannot be loaded, when the page is shown, then the fallback (genre theme or monogram) is shown, no error is shown, and the rest of the page works (the same rule as REQ-0016).
- Given that a logo or cover is shown, when a screen reader reads the page, then the image is decorative (empty text alternative), because the game name is always shown as text (WCAG 1.1.1).
- Given that an admin changes or removes an image, when a member next views a lobby of that game, then the new image or the fallback is shown (DECISION, user, 2026-11-15, ADR 0026: the image follows the game, the same rule as the genre in REQ-0014; an open page shows the new image after its next data load).
- Given that I am logged in, when I open a game image, then it is served by our own service; the browser makes no request to another host (privacy, Content Security Policy).
- Given that I am logged in, when I open a game image, then it is shown to me whether or not I am a member of a group with that game. DECISION, user, 2026-11-15 (ADR 0026, point 4): any logged-in user may load a game logo or cover.
- Given that I am logged out, when I open the landing page, then no game image is shown (REQ-0013 keeps its placeholder cards).

## Delivery
DECISION, user, 2026-11-15: built in two small PRs, logo first. PR 1: the logo (upload, removal, monogram fallback, game form, game list, Next up card, lobby page). PR 2: the cover on the Next up card (replacement of the genre pattern, contrast rule). Sequence and owners in ADR 0026, point 12.

## Out of scope
- Images from a web address that an admin pastes (DECISION, user, 2026-11-15: upload only).
- Saving the images together with the game form (DECISION, user, 2026-11-15: each image is saved on its own; a single save would need its own ADR).
- The per-game accent color of F-030. It is a separate part of F-030 and is not built here; when it is built, it overrides the genre accent color (REQ-0014).
- Images for modes, named activities, genres, groups, members or game roles. Game roles have their own fixed icon set (REQ-0023).
- Images in the lobby list, the week calendar blocks and the lobby labels (DECISION, user, 2026-11-15: labels stay text-only; the lobby list and week blocks are not in the places above).
- More than one logo or cover per game, a crop or edit tool in the app, animated images.
- Images chosen by members or group admins. The game list stays managed by the system admin only (REQ-0010).
- Images on the landing page or in the group list (REQ-0024).
- Legal review of the trademark risk. The user accepted the risk for logos (2026-11-04) and for cover art (2026-11-15).

## Related features
- F-030 (Game presentation: logo and accent color): this requirement is its logo part (decided 2026-11-04), extended with a cover. Not a new feature; F-030 is asked for the third time (2026-11-10, 2026-11-13, 2026-11-15) and is not added again.
- F-032 and REQ-0014 (genre themes): the genre gives the default look per genre, with no real art. A game cover replaces the genre background pattern on the Next up card, and the genre accent border and icon stay (DECISION, user, 2026-11-15). Without an image the genre theme is unchanged. REQ-0014 excludes cover art for the genre themes; that exclusion stays for the themes, and game covers are allowed by this requirement. ADR 0016 section 7 is amended by ADR 0026.
- F-025 and REQ-0010 (game list and its form): the images are new fields per game. REQ-0009 excludes more fields per game, so REQ-0009 is amended in the same change (Amendment 2026-11-15, as for genre and role icons).
- F-029 and ADR 0018 (Discord avatars): a precedent for storing and serving images. Avatars are pictures of people, shared only within groups; game images are not personal and are shown to all logged-in users. Different need and rule, not a duplicate.
- F-042 and REQ-0023 (game role icons): a fixed icon set per game role. Game images are uploaded per game. Different need and data, not a duplicate.
- F-043 and REQ-0024 (group cards): no game image is shown there, so it is not affected.

## Decisions (user, 2026-11-15)
1. DECISION, user, 2026-11-15: the cover is per game. A game without a cover shows the genre theme.
2. DECISION, user, 2026-11-15: logo and cover, both optional. Built in two small PRs, logo first.
3. DECISION, user, 2026-11-15: source is an upload in the game form by the system admin, stored by our system.
4. DECISION, user, 2026-11-15: the trademark acceptance covers cover art too.
5. DECISION, user, 2026-11-15: the cover replaces the genre background pattern on the Next up card; the genre accent border and icon stay.
6. DECISION, user, 2026-11-15: the logo appears in the game form, the game list, the Next up card and the lobby page. Labels stay text-only.
7. DECISION, user, 2026-11-15: priority Should, start now, before avatars (REQ-0016) and the rest of the backlog.
8. DECISION, user, 2026-11-15 (ADR 0026, point 1): each image is uploaded and removed by its own action, saved when the file is chosen. Saving the game does not carry images.
9. DECISION, user, 2026-11-15 (ADR 0026, point 4): any logged-in user may load a game logo or cover.

## Amendment 2026-11-16 (game choice and logo size)
Status stays Decided. Feature F-030 (EXTEND, not a new feature). Two parts, both DECISION, user, 2026-11-16. The game choice part needs the Dropdown list of REQ-0027, because a native option cannot show an image, so it is built after REQ-0027.

Sizes (design tokens, ADR 0023): the game logo in the game list, the game form and the game choice is `--size-game-logo` (2.5rem); on the Next up card and the lobby page it is `--size-game-logo-large` (4rem).

Replaced wording (kept for the record): "the logo appears in the game form, the game list, the Next up card and the lobby page only" (DECISION, user, 2026-11-15) and "shown at a fixed size" (REQ-0026, Showing the images).

Size:
- Given that I am logged in, when a lobby's game has a logo and the lobby is shown on the Next up card or on its lobby page, then the logo is `--size-game-logo-large` (4rem) high, next to the game name, and the name is still shown as text. DECISION, user, 2026-11-16: the game is central on these two places.
- Given that I am a system admin, when I look at the game list or the game form, then the logo is `--size-game-logo` (2.5rem), as before. DECISION, user, 2026-11-16.
- Given that a place shows the monogram because the game has no logo, when I see it, then the monogram takes the size its logo would have in that place, so the layout does not change when a logo is added. ASSUMPTION (product owner).
- Given that I view the lobby page on a phone (window under 760 px) with a 4rem logo, when the page is shown, then the logo and the name wrap, no line of text is cut, and the page does not scroll sideways. ASSUMPTION (product owner).

Game choice and game headings (wherever there is a list of game titles):
- Given that I am a member, when I open the game choice of the create lobby form, or the game choice of an open lobby in the lobby settings, then each game row shows its logo at `--size-game-logo`, or its monogram without a logo, and its name as text. DECISION, user, 2026-11-16.
- Given that a game is chosen in the game choice, when I look at the closed field, then it shows the chosen game's logo or monogram before its name, as its row does. DECISION, product owner, 2026-11-16 (REQ-0027; the user may change it).
- Given that the game choice shows "Other" or "no game", when I look at that row or the closed field, then it shows neither a logo nor a monogram. ASSUMPTION (product owner): "Other" has no logo (REQ-0026, Other).
- Given that I am logged in, when I see the Game roles section of the You page (REQ-0021), then each game heading shows the game's logo or monogram before its name, at `--size-game-logo`. DECISION, user, 2026-11-16 (REQ-0027).
- Given that a lobby is shown in a lobby list, in the week view or as a label, then no logo or monogram is shown, because labels stay text-only. DECISION, user, 2026-11-16 (confirmed; REQ-0027).
- Given that the game choice is shown on a phone, when I open it, then its rows show the logos too, in the full-width sheet of REQ-0027. DECISION, user, 2026-11-16.
- Given that a logo fails to load in the game choice, when the list is shown, then the monogram is shown and no error is shown (the rule above).

Not changed: the mode, activity, genre and max uses lists have no game titles and show no logo.

## Amendment 2026-11-16 (cover places)
Status stays Decided. Feature F-030 (EXTEND, not a new feature). DECISION, user, 2026-11-16: the game cover is also shown on the lobby page and on the lobby rows of the group view's list (REQ-0004). Replaced wording: "Images in the lobby list, the week calendar blocks and the lobby labels" (Out of scope, DECISION, user, 2026-11-15), now only the week calendar blocks, the labels and the Dashboard lists stay out (see Not changed below).

Places:
- Given that I am logged in, when a lobby's game has a cover and I open its lobby page, then the cover fills the page header behind its content, in place of the genre background pattern. DECISION, user, 2026-11-16.
- Given that I am logged in, when a lobby's game has a cover and the lobby is a row in the group view's list (REQ-0004), then the cover fills the row behind its content, in place of the genre background pattern. DECISION, user, 2026-11-16 ("listvyn i gruppen").
- Given that a cover is shown on a lobby page header or a list row, when I look at it, then the genre accent border and the genre icon of REQ-0014 stay visible, as on the Next up card (line 35). ASSUMPTION (product owner): the Next up rule applied to the new places.
- Given that a cover is shown on a lobby page header or a list row, when I read its text (the label, the genre name, the time, the creator, the player count, the role slot badges, and in the header the monogram), then each text has a contrast of at least 4.5:1 against what is behind it, or 3:1 for large text, as WCAG defines it (the scrim is allowed). The check uses the lightest and the busiest cover of the test fixtures. DECISION, orchestrator, 2026-11-16, the rule of line 36 for the new places.
- Given that a cover is shown on a lobby page header or a list row, when it is shown, then it is cropped to fill, not stretched, as on the Next up card (line 34). ASSUMPTION (product owner).
- Given that a cover is shown on the lobby page header, when the page shows the logo of Amendment 2026-11-16, then the logo stays beside the game name at `--size-game-logo-large`, on top of the cover. ASSUMPTION (product owner).
- Given that a game has no cover, or its cover cannot be loaded, when its lobby page header or list row is shown, then the genre theme is shown as today (REQ-0014), with no error. DECISION, user, 2026-11-15 (line 37), extended to the new places.
- Given that a cover is shown on a lobby page header or a list row, when a screen reader reads the page, then the cover is decorative (empty text alternative), as on the Next up card (line 42).
- Given that a lobby row shows its cover, when the row shows its label, then the label stays text-only. The cover is a background behind the row, not a logo or monogram, so the rule of Amendment 2026-11-16 (no logo or monogram in a lobby list) still holds.
- Given that a lobby is "Other" or an open lobby with no game (line 40), when I see its page header or row, then it shows no cover. Unchanged.

Not changed (ASSUMPTION (product owner), the user did not say otherwise):
- The week calendar blocks of the group view and of the Dashboard: no cover.
- The Dashboard lists (This week, Day list) and the Next up card's other places: no cover on the list rows. The Next up card keeps its cover (line 34).
- The group list page and its Group cards (REQ-0024): no cover.
- Labels, the game list, the game form, the game choice and the mode, activity and genre lists: no cover.

Delivery: a follow-up to PR 2 (the cover on Next up), ASSUMPTION; the orchestrator sets the PR split.

Questions for the user (recommended answer):
- Should the cover also show on the Dashboard's Day list (REQ-0012)? Recommended: no, not now. The user asked for the group's list view. It can be added later as one short amendment.
- Should the cover show on the week calendar blocks? Recommended: no. The blocks are too small for the text and the contrast rule.

## Assumptions (not decided by the user; the architect may refine the limits)
- Limits: PNG, JPEG or WebP only; at most 512 KiB (524288 bytes) per image (ADR 0026, points 3 and 6).
- The image follows the game and changes at the next view (as REQ-0014).
- The cover is cropped to fill the card, not stretched.
- Text on a cover meets WCAG AA (contrast rule above; ADR 0026, point 8).
- Storage and delivery: ADR 0026 (table in `calendar`, version in the URL). Containers stay stateless.

## Amendment 2026-11-17 (member list, Group view: game name not shown)
Status of this amendment: Decided (2026-11-17). Status of REQ-0026: Decided, unchanged. Feature F-030 (EXTEND, not a new feature).

DECISION (user, 2026-11-17, see REQ-0021 Amendment 2026-11-17): in the member list of the Group view, a game's logo or monogram is shown without the game name as visible text, next to the member's Role icons. This is an exception to the rule that the game name is always shown as text beside the logo (line 38 and line 42), for this place only. The exception does not change anything else in this requirement.

Places:
- Given that I am a member of a group, when I see the member list of its Group view and a member has preferred game roles of a game, then the game's logo (or its monogram when it has no logo) is shown at the regular size of Amendment 2026-11-16, with no game name as visible text.
- Given that the logo or monogram is shown in this place, when a screen reader reads the member list, then the logo and monogram are hidden from it, and the game name is read as part of the member's Game chip (REQ-0021 Amendment 2026-11-17: the Game chip's accessible name is the full text, with the game name). The game name is therefore never missing for a screen reader (WCAG 1.1.1, 4.1.2).
- Given that the monogram is shown in this place, when it has visible letters, then the letters are a visual cue only and are hidden from assistive technology, because the Game chip's accessible name holds the game name.

Not changed (the game name stays beside the logo):
- The Next up card, the lobby page, the game list, the game form, the game choice and the game headings of the You page.
- Lobby labels, the lobby list, the week view and the Dashboard (labels stay text-only; Amendment 2026-11-16).
