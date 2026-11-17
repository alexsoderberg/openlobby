# REQ-0021. Preferred game roles per member
Status: Implemented. Amendment 2026-11-17 (compact display in the member list): Decided, not built (see the end of this file).
Feature: F-039
Priority: Should

Decided by the user on 2026-11-12 (wish "fill in the classes I play"; user writes Swedish). "Class" is a term to avoid; the glossary term is Game role. The user decided the purposes (a) and (b), the visibility of (b), the choice per game role with the mode name and the choice for all groups (Questions 3 and 4), and all seven ADR 0022 questions (1, 2, 3 and 6 first, 4, 5 and 7 confirmed later the same day). ADR 0022 is Accepted (2026-11-12). The term "Preferred game role" is defined in ADR 0022 and its glossary row.

## Problem
When I join a lobby with game roles (REQ-0011), I choose my game role again in every lobby. If I always play the same game role in a game, the same choice repeats every time. Other members also have no way to see which game roles a member usually plays in a game, so they cannot tell from the lobby or the member list who plays what.

## User story
As a member I want to record which game roles I play in each game, so that my usual game role is preselected when I join a lobby of that game, and so that the members of my groups can see which game roles I play.

## Acceptance criteria

Recording:
- Given that I am logged in, when I open the You page, then I see a section "Game roles" between "Account" and "System admin" that lists each game that has game roles and can choose which of its game roles I play. Choosing none is allowed. The list is shown to any signed-in member, also to a member who is in no group (DECISION, user, 2026-11-12).
- Given that a game has no effective game role (ADR 0017 section 2), when I open the list, then that game is not shown. A game whose only role is a game-level role of a game with modes is not shown.
- Given that I have chosen game roles for a game and I save, when I open the list again, then my choice is shown.
- Given that a system admin removes a game role that I have chosen, when I open the list, then that game role is no longer offered, and the removal is silent: no error is shown (same rule as REQ-0011 for removed game roles; DECISION, user, 2026-11-12).
- Given that I choose game roles for a game with modes, when I see the choices, then each game role is shown with its name and the name of its mode (DECISION, user, 2026-11-12: per game role, not per game).
- Given that I save my choice, when I save it, then it applies to all groups I am a member of, and I do not choose it per group (DECISION, user, 2026-11-12: one choice for all groups).

Joining (extends REQ-0011 and REQ-0005):
- Given that I join a lobby with game roles, and I have chosen game roles for its game, when the join form opens, then the first of my chosen game roles that has a free slot is preselected, in the order and by the rule of ADR 0022 point 7.
- Given that none of my chosen game roles has a free slot, when the join form opens, then nothing is preselected and I must choose a seat, as in REQ-0011 (DECISION, user, 2026-11-12).
- Given that a seat is preselected, when I choose another seat before I click "Join lobby", then my choice is used. The preselection is not saved.
- Given that I have chosen no game roles for the game, or the lobby has no game roles, when the join form opens, then nothing is preselected, as today.

Lobby players:
- Given that a lobby has game roles, when I see its players, then each player's chosen game roles are shown for every mode of the lobby's game, as far as the player has chosen them (DECISION, user, 2026-11-12).

Visibility (decided by the user, 2026-11-12, option (b)):
- Given that I have chosen game roles, when a member of a group I share with me sees a lobby or a member list of that group, then my chosen game roles are shown.
- Given that I have chosen game roles, when a member of no group I share with me sees a lobby or a member list, then my chosen game roles are not shown.
- Given that I am a member of a group and I share it with another member, when that member has chosen game roles, then I see them in the same places as I see my own avatar (REQ-0016, F-029).

## Out of scope
- Suggesting or assigning a game role to a member, or to a group to fill a missing game role (option (c)). REQ-0011 excludes "matching, rank, skill or suggestions for who should play which role".
- Skill, rank, hours played or any other attribute of a player.
- Changing the game roles of a game (REQ-0010, REQ-0011) or of a lobby (REQ-0011).
- Reading a player's game profile or any game state (vision.md: no integration with the games).
- Games without game roles, and "Other".
- A separate choice per group.

## Related features
- F-027 (Game roles and role slots in lobbies): F-027 has the seat choice when joining a lobby. This requirement adds a standing choice per member that preselects that seat and is shown to group members. It is not a duplicate: F-027 chooses a seat in one lobby, this stores the game roles a member usually plays across lobbies.
- F-005 (Join and leave lobby): the join form gets a preselection. REQ-0005 stays the rule for joining.
- F-024 and F-025 (game list): the game roles belong to the game list. The member's choice refers to them and adds no field to the game list.
- F-029 (Discord avatars): the visibility rule follows the same rule as the avatar: members of groups the viewer shares with the owner.
- F-031 (Per-player item goals): also per-player data kept for a game, but a different need, and its decision is postponed. Not a duplicate.
- REQ-0020 (Account settings panel): the You page is where the choice is made, in its own section "Game roles" between "Account" and "System admin", not inside "Account" (see the placement decision below, adopted by the product owner on 2026-11-13).

## Decisions
- DECISION (user, 2026-11-12): the purposes are (a) preselect my seat when I join a lobby and (b) show my game roles to other members.
- DECISION (user, 2026-11-12): visibility for (b) is the same rule as avatars: members of groups I share with the member.
- DECISION (user, 2026-11-12): the choice is per game role, shown with the mode name (Question 3).
- DECISION (user, 2026-11-12): one choice for all groups (Question 4).
- DECISION (user, 2026-11-12): ADR 0022 question 1, the account list shows to any signed-in member, also with no group; question 2, lobby players show choices for every mode of the game; question 3, a removed role's choice is removed silently; question 6, nothing is preselected without a free preferred slot.
- DECISION (user, 2026-11-12): question 4, a stale ID on save gives `invalid_game_role`, and the list reloads; question 5, a choice for a game role of a game with modes is dropped at the member's next save; question 7, REQ-0020 is merged before PR4.
- ASSUMPTION (optional): recording is optional. Nothing chosen means no preference.
- DECISION (architect, ADR 0022, 2026-11-12, adopted by the product owner on 2026-11-13), place: the choice sits in its own section "Game roles" on the You page, between "Account" and "System admin". It is not inside "Account". Reason: REQ-0020 gives later settings their own section above "Log out", and a list of games in "Account" would mix the name and avatar with gameplay choices.
- DECISION (architect, ADR 0022, 2026-11-12, adopted by the product owner on 2026-11-13), games without roles: the server alone leaves out a game with no effective game role, and the page shows the games it receives. The criterion "a game with no effective game role is not shown" stays as written; it is met by the server rule together with the page.
- Option (c) is not part of this requirement. It would need REQ-0011 amended first.
- Priority Should: the user is actively asking for it.

## Questions for the user
None open. Answered 2026-11-12:
1. What is it for? (a) and (b). Option (c) is not in scope.
2. Who sees my chosen game roles? The same rule as avatars.
3. Per game role or per game? Per game role, shown with the mode name.
4. One choice for all groups, or one per group? One for all groups.

## Open questions from ADR 0022
All seven questions of ADR 0022 (section "Open questions for the user") are answered or decided.
1. A signed-in person who is in no group sees the game catalogue: DECISION (user, 2026-11-12), yes.
2. Lobby player choices are shown for every mode of the lobby's game: DECISION (user, 2026-11-12), yes.
3. A choice is removed when the admin removes its game role, and nothing is shown or said: DECISION (user, 2026-11-12), yes.
4. A stale ID on save gives `invalid_game_role`, the list reloads, and the member saves again: DECISION (user, 2026-11-12).
5. A choice for a game role of a game with modes is dropped at the member's next save and hidden until then: DECISION (user, 2026-11-12).
6. When no preferred role has a free slot, nothing is preselected: DECISION (user, 2026-11-12), yes.
7. REQ-0020 is merged before PR4 of ADR 0022: DECISION (user, 2026-11-12).

## Architect
ADR 0022 (Accepted, 2026-11-12) holds the storage and the API: the game and its game roles belong to the calendar service (REQ-0010 and REQ-0011), and the member comes from the gateway header. The term "Preferred game role" (avoid: class, main role, role alone) is defined there and in its glossary row. Implementation follows the design in ADR 0022.

## Amendment 2026-11-17 (compact display in the member list)
Status of this amendment: Decided (2026-11-17). Not built. The data design is in ADR 0022 Amendment 2026-11-17. The build waits for the role icons (ADR 0024 PR1a to PR3) and then for the Game chip components (CH1 to CH3, with the popover built in CH2b). Status of REQ-0021 itself: Implemented, unchanged.
Feature: F-039 (EXTEND, not a new feature). The user's wish: "I don't need all this text in the member list under /groups/{id}; logos or something else would do."

Decisions:
- DECISION (user, 2026-11-17, Q1): a popover opened by click, tap, Enter or Space, on every device, shows the full text. No hover.
- DECISION (user, 2026-11-17, Q5): only the member list of the Group view changes. The lobby player list and the You page keep the current text.
- DECISION (user, 2026-11-17): in the member list of the Group view the game name is not shown as visible text. Only the game logo or monogram and the role icons are shown. The full text, with the game name, is the accessible name of the Game chip and is the text of the popover. This is an exception to REQ-0026's rule that a game name is always shown beside its logo, for this place only (REQ-0026 Amendment 2026-11-17).
- DECISION (user, 2026-11-17): the popover is `AnchoredPopover` (Radix Popover), built in CH2b, before the Dialog family (ADR 0023; the earlier `ui/Popover.tsx` plan is renamed CreateFrame in CH2a, which this requirement does not depend on by name).
- ASSUMPTION (product owner, 2026-11-17, the user may override): Q2, Q3, Q4, Q6 and Q7 as set out in "Decisions and assumptions" below.

Term: the Game chip (CLAUDE.md glossary). One Game chip is one game of one member's preferred game roles in the member list. Avoid "item" and "compact item" for it.

Scope: only the member list of the Group view (REQ-0002). It replaces the text "Plays ..." next to a member's name in that list. The list sits in the side column from 98rem; below 98rem the members panel sits below the lobbies (REQ-0025, line 48). Everything else in REQ-0021 stays as written, including recording, joining, visibility, and the lobby player list and the You page.

Current text, for reference: "Plays Top, Jungle in League of Legends; Support in Overwatch; Tank (Dungeon 1-3-1) in World of Warcraft". It takes a full line per member.

Terms (CLAUDE.md glossary): Preferred game role, Game role, Role icon (REQ-0023), Game logo and Monogram (REQ-0026), Game chip, Member list (of the Group view), Game (`gameId`).

### Data the Game chip needs (designed in ADR 0022 Amendment 2026-11-17)
The Game chip groups a member's preferred game roles by game, draws the game's logo, and draws each role's icon. The member list today has, per preferred game role, the game name, the mode name, the role name and (planned by ADR 0024) the role icon. It does not have:
- the game's identity, so the roles can be grouped by game (the game name is not a safe key, since it is not shown and can repeat);
- the game's logo version, so the Game logo can be drawn (REQ-0026 point 5 defines the field for games; the member's roles need it too);
- the role icon of each preferred game role, which ADR 0024 adds to the preferred game role; this is required for the Game chip, not only for the game form.
The data design is in ADR 0022 Amendment 2026-11-17. The backend provides the contract change in `api/` before the frontend work starts. The Game chip must not join the game list from the frontend. The server already sends the roles in game order (ADR 0022); that order is kept.

### Game chip (Decided; Q2 to Q4 and Q6 are assumptions)
- Given that I am a member of a group, when I see its member list, and a member has preferred game roles, then each game of those roles is one Game chip: the game's Game logo at the regular size of REQ-0026 (Amendment 2026-11-16), or its Monogram when it has none, followed by the Role icon of each of that game's preferred game roles that has one. The game name is not shown as visible text.
- Given that a preferred game role of a game has no Role icon, when I see the Game chip, then the role's name is shown as short visible text after the icons of its game, e.g. "Top, Jungle" (ASSUMPTION, Q4).
- Given that a member has preferred game roles in several games, when I see the member list, then there is one Game chip per game, in the order the server sends them, and the Game chips wrap onto the next line on a narrow row. There is no limit on the number of Game chips (ASSUMPTION, Q3).
- Given that a member has no preferred game roles, when I see the member list, then nothing is shown, as today.
- Given that two preferred game roles of one game have the same Role icon, when the Game chip is shown, then that icon appears once (ASSUMPTION, Q2).
- Given that a Game chip is shown, when a screen reader reads the member list, then the Game chip's accessible name is the full text of REQ-0021 ("Plays ... in ..."), with the game name, the role names and the mode names. The logo, the monogram and the icons are hidden from assistive technology, so they never carry the information alone (WCAG 1.1.1, 4.1.2; REQ-0023 line 35).
- Given that a Game chip is shown, when I use a phone, then its tap target is at least 44 px high and 44 px wide, and the Game chip does not change the layout of the list (REQ-0023, line 36).
- Given that the Game logo is shown in a Game chip at the regular size, when a game has a logo, then the logo is shown at the size of REQ-0026 (Amendment 2026-11-16, regular); no new size is added (ASSUMPTION, Q6).

### Full text on demand (Decided, Q1)
- Given that a Game chip is shown, when I click it, tap it, or press Enter or Space while it has keyboard focus, then a popover shows the full text as today, with game names, role names and mode names.
- Given that the popover is open, when I press Escape or tap outside it, then it closes and keyboard focus returns to the Game chip.
- Given that the popover is open on a phone, when it is shown, then its text is not cut and the page does not scroll sideways.
- Given that I use the keyboard, when I move through the member list, then the Game chip is reachable in the normal tab order and has a visible focus ring (WCAG 2.4.7).
- The popover is `AnchoredPopover` (Radix Popover, backlog row A3f, DECISION, user, 2026-11-17).

### Roles and modes
- Given that a preferred game role has a Role icon, when the Game chip is shown, then only the icon is visible, and its name is in the full text (ASSUMPTION, Q2).
- Given that a member has preferred game roles in several modes of one game, when the Game chip is shown, then the mode names are not visible; they are in the full text (ASSUMPTION, Q2).

### Out of scope
- Changing how game roles are chosen, saved or shown on the You page, in joining, or on lobby pages (Q5).
- Mode names and game names as visible text in the member list.
- Any new icon or new Role icon value (REQ-0023 set is unchanged).
- A new size for the Game logo in the member list (Q6).
- Labels of Next up, This week and the lobby list: no logo, no icon, no game role text there (REQ-0026, REQ-0023).
- Showing game roles to people who share no group with the member (REQ-0021 visibility, unchanged).
- Avatars in the member list (REQ-0016, F-029). The avatar rule is decided there.

### Consequences for other requirements
- REQ-0023 lines 9, 31 and 35 are amended for the member list (2026-11-17).
- REQ-0026 gets Amendment 2026-11-17 for the name exception.
- Tooltip (CLAUDE.md glossary, ADR 0021 point 2): not used here. The popover of Q1 needs no change to the Tooltip rule. The popover is `AnchoredPopover` (backlog row A3f).

### Decisions and assumptions (questions of 2026-11-17; options and recommendations kept for the record)

Q1. DECISION (user, 2026-11-17): option B. How does a person read the full text (game, role and mode names) now that it is not shown inline?
- A. Popover opened by hover or keyboard focus on a mouse and by tap on a phone. Closest to the tooltip the brief mentioned. Needs the architect to decide whether the Tooltip rule (ADR 0021, glossary) covers it; a hover popover is a tooltip in all but name.
- B. Popover opened by click, tap, Enter or Space, on every device. One interaction, no hover, no change to the Tooltip rule. Recommended: simplest, and works on touch without a second code path. A mouse user must click to see the names.
- C. No visible text; the names only in the accessible name. Not recommended: icons without names cannot be learned by sight, and a role without an icon would show a name while its neighbours show none.
- Recommendation: B.

Q2. ASSUMPTION (product owner, 2026-11-17, the user may override): option A. Mode names and icons that repeat within one game (for example Tank in Dungeon and Tank in Raid, both shield)?
- A. Mode names only in the full text; each icon once per game. Recommended: the icon is the same role, the mode is detail.
- B. Each mode shown as a short text after its icon ("shield Dungeon 1-3-1"). Keeps the mode visible, but adds text the user wants less of.
- C. One icon per preferred game role, repeats shown, no mode names. Not recommended: "shield shield" in one row.
- Recommendation: A.

Q3. ASSUMPTION (product owner, 2026-11-17, the user may override): option A. A member with many games (the member list is in the narrow side column from REQ-0025)?
- A. One Game chip per game, no limit, wrapping. Recommended now: a member usually has a few games with game roles, and a cap is a rule nobody asked for yet. Revisit if the list is long in use.
- B. At most three Game chips; a "+N" Game chip opens the full text (Q1) for the rest. Keeps rows short for people with many games, adds one rule to test.
- Recommendation: A, with B as the fix if the member list grows too tall in review.

Q4. ASSUMPTION (product owner, 2026-11-17, the user may override): option A. A preferred game role without a Role icon (no icon chosen, or "No icon", e.g. "Top" and "Jungle" in League of Legends)?
- A. Its name is shown as short visible text after the icons of its game, e.g. "Top, Jungle". Recommended: no information is lost on the row, and it is shorter than today because the game name is gone.
- B. Not shown on the row; only in the full text (Q1). Shorter, but a row with only a logo hides which roles a person plays.
- Recommendation: A. It is the one place where text stays inline.

Q5. DECISION (user, 2026-11-17): option A. Where does the compact form apply?
- A. Only the member list of the Group view, the place the user named. Recommended. The lobby player list and the You page keep the current text until the user asks.
- B. The member list of the Group view and the lobby player list. In a lobby every player has the same game, so the Game chip would show icons without a logo; the change is a second rule for one place.
- Recommendation: A. Decided: A.

Q6. ASSUMPTION (product owner, 2026-11-17, the user may override): option A. Size of the Game logo in the member list?
- A. The regular size of REQ-0026 (Amendment 2026-11-16), the size of the game list and the game choice. No new size. Recommended. It may make a member row tall when a person has several games; check in review.
- B. A new smaller size for the member list, e.g. 1.5rem. Needs a DECISION by the user (REQ-0026 fixed the sizes by the user's decision) and a new design token (ADR 0023).
- Recommendation: A.

Q7. ASSUMPTION (product owner, 2026-11-17, the user may override): Should, after REQ-0027 (A3e) and before REQ-0016 (A4). Priority and order.
- Reason for the order: the row is the same one that REQ-0016 (avatars, A4) changes, so doing this first avoids changing the row twice. It comes after REQ-0027 as the user ordered. The build order is: the role icons (ADR 0024 PR1a to PR3) first, then the Game chip components CH1 to CH3, as the coordinator set on 2026-11-17.
- Alternative: Could (a presentation tweak with no new data beyond the contract change), placed after A4 and A5.

Assumptions (product owner, not decided by the user): the Game chip stays on the existing row and reuses the existing full text, so no new text is needed for the accessible name.
