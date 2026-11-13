# REQ-0023. Icons for game roles
Status: Decided
Feature: F-042
Priority: Should

## Decisions
- DECISION (user, 2026-11-13, question 1): both. The form suggests an icon from the role name, and the system admin can change it in the game form. The suggestion is only a prefill; the saved value is the admin's choice.
- DECISION (user, 2026-11-13, question 2): the icon set is shield (Tank), medical cross (Support, Healer), dagger (DPS, Damage), crosshair (Sniper, ranged), wrench (Engineer), star (other), plus "No icon". The set is fixed in the product, not entered by the admin.
- DECISION (user, 2026-11-13, question 3): the icon is shown everywhere a game role appears: role slots ("Tank 0/1"), the lobby player groups, the seat choice in create and join, and preferred game roles on the You page and next to names (REQ-0021). Flex never has an icon. Not shown on Next up or This week labels.
- DECISION (user, 2026-11-13, question 4): the game form suggests an icon for each game role that has none, and nothing is saved until the admin saves the form.
- DECISION (user, 2026-11-13, question 5): priority Should, built right after the shadcn rollout and toasts (A3a, REQ-0022) and before A4 to A6. F-030 (logo and colour) stays where it is.

## Problem
Game roles are shown as text only ("Tank 0/1", "Support 1/2"). In a lobby with several roles, a player has to read every label to find the role they play, and a member scanning the week view or a lobby list sees no visual difference between roles. The user asked for a recognisable icon per role, for example a shield for Tank, a medical cross for Support and a dagger for DPS.

## User story
As a member, I want each game role to have a recognisable icon next to its name, so that I can see at a glance which role a seat, a slot or a player belongs to.

## Acceptance criteria
Icon set and choice (system admin):
- Given that I am a system admin, when I add or change a game role of a game or of a game mode, then the form offers the fixed icon set (shield, medical cross, dagger, crosshair, wrench, star) and "No icon", and I can choose one of them.
- Given that I am a system admin, when I save a game role without choosing an icon, then it is saved with "No icon" and no error is shown.
- Given that I am a system admin, when I save a game role with an icon, then the icon is shown with the game role wherever the game role is shown.
- Given that I am a system admin, when I open the game form for a game role that has no icon yet (a new game role, or an existing one), then the form preselects an icon from the role's name if one matches ("Tank" gives shield, "Support" gives medical cross, "DPS" gives dagger), I can change it before I save, and nothing is saved until I save the form.
- Given that I am a system admin, when I change a game role's icon, then lobbies that already use the game role keep the icon they had when they were created, in the same way as their name (REQ-0011).

Display (members):
- Given that a game role has an icon, when I see it in a lobby list or in the lobby detail view, then the icon is shown before the game role's name, for example "[shield] Tank 0/1".
- Given that a game role has an icon, when I choose a game role in the join or create form, then the icon is shown next to its name.
- Given that a game role has an icon, when I see the players of a lobby under their game role, then the icon is shown with the game role heading.
- Given that a member has preferred game roles (REQ-0021), when I see them on the You page or next to a member's name, then the icon of each preferred game role is shown with its name.
- Given that a game role has no icon, when I see it anywhere, then it is shown with its name only, as today.
- Given that a player is in the flex group, when I see it, then it is shown as "Flex" with no icon.
- Given that a lobby is shown as a label on Next up or This week, when I see it, then no game role icon is shown there.
- Given that an icon is shown, when a screen reader reads the page, then the icon is hidden from it and the game role's name is read as text, so the icon never carries information alone.
- Given that I use a phone, when an icon is shown, then it is never smaller than the text it stands next to, and it does not change the layout of the lobby list.

Out of scope:
- Image uploads for roles, or icons chosen by members or group admins.
- Icons for games, modes, named activities, genres or groups (game logo: F-030; genre look: F-032).
- Icon suggestions computed on the server. The name only suggests an icon in the form.
- Icons for each player, for example a player's own picture or avatar (F-029).
- Translating icon names. Icons are project-owned names, not UI text.
- Matching, rank or suggestions for who should play which role (REQ-0011).

## Related features
- F-027 (Game roles and role slots, REQ-0011): this extends F-027 with one attribute of a game role. REQ-0011 lists "Icons or images for game roles" as out of scope and excludes more fields per game (REQ-0009). This requirement lifts that exclusion for an icon chosen from a fixed list only. Not a duplicate: F-027 defines the roles and their slots, this defines how a role looks.
- F-025 (Manage game list as system admin, REQ-0010) and F-033 (game modes, REQ-0015): the icon is entered in the same game form. No second place to manage games.
- F-030 (Game presentation: logo and accent colour, Could): F-030 is a logo and a colour per game, uploaded by a system admin. This is an icon per game role, chosen from a fixed list. Different need and different data, so not a duplicate. Both change the game form, so the architect should review them together if both are built.
- F-032 (Game genre themes, REQ-0014): a genre has a designed icon as part of its theme, per game. A game role icon is per role, chosen by the admin. Not a duplicate.
- F-039 (Preferred game roles, REQ-0021): the icon is also shown where a member's preferred game roles are shown.

## Amendments made with this decision (2026-11-13)
- REQ-0011 (Out of scope, "Icons or images for game roles"): narrowed to images and to icons outside the fixed set. Recorded as an amendment in REQ-0011.
- REQ-0009 (Out of scope, "More fields per game"): the field exclusion is lifted for a game role's icon only. A game role is a field of the game's role list, not a new field of the game. Recorded as an amendment in REQ-0009.
- The icon set uses the project's own icon names (CLAUDE.md, "Icon", ADR 0021).

## Open questions
None. All five questions are answered (see Decisions).
