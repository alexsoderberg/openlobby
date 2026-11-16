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
- Given that I am logged in, when a lobby's game has a logo, and the lobby is shown on the Next up card (REQ-0012) or on its lobby page, then the logo is shown at a fixed size next to the game name, and the name is still shown as text. DECISION, user, 2026-11-15: the logo appears in the game form, the game list, the Next up card and the lobby page only.
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

## Assumptions (not decided by the user; the architect may refine the limits)
- Limits: PNG, JPEG or WebP only; at most 512 KiB (524288 bytes) per image (ADR 0026, points 3 and 6).
- The image follows the game and changes at the next view (as REQ-0014).
- The cover is cropped to fill the card, not stretched.
- Text on a cover meets WCAG AA (contrast rule above; ADR 0026, point 8).
- Storage and delivery: ADR 0026 (table in `calendar`, version in the URL). Containers stay stateless.
