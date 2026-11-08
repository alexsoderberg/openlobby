# REQ-0015. Game modes, named activities and open lobbies
Status: Decided
Feature: F-033, F-034
Priority: Should

Decided by the user (DECISION, user, 2026-11-07) in four points, and the user's answers to the twelve questions of 2026-11-08 (DECISION, user, 2026-11-08). They are listed under Decisions. The acceptance criteria are written by the product owner. The ASSUMPTIONs are the product owner's defaults for details the user did not address; they are listed under Assumptions and stand unless the user overrules them. The data model, API and design are the architect's.

## Problem
A game can have several kinds of play with different group sizes. In a dungeon-and-raid game a dungeon is for 5 players and a raid for 20. Today a lobby has one game and one max players (REQ-0003, REQ-0009), so the group cannot say which kind of play it is, and the limit is right for one kind only. Members also want to block a time before the group has agreed what to play ("we play something at 20:00"), or to name the game without the kind of play ("WoW at 20:00"). Today a game is mandatory (REQ-0003), so neither is possible.

## User story
As a member, I want to choose the kind of play and, if I know it, the named activity for a lobby, or leave these open, so that the group sees what we play, the limit fits the kind of play, and we can block a time before we agree on the activity.

## Terms used in this requirement
- **Mode** (game mode): a kind of play within a game, with its own limit, e.g. "Dungeon" (5 players) or "Raid" (20 players) in a dungeon-and-raid game. A mode has game roles (REQ-0011) or a max players value.
- **Activity** (named activity): a specific thing played in a mode, e.g. a particular dungeon. Optional. An activity belongs to exactly one mode.
- **Open lobby**: a lobby without a mode (DECISION, user, 2026-11-08). It is either a lobby without a game ("we play something at 20:00") or a lobby with a game and no mode ("WoW at 20:00").

## Acceptance criteria

Modes and activities (system admin, in the game form of REQ-0010):
- Given that I am a system admin, when I add or change a game, then the form lets me list its modes, each with a name and either its game roles (REQ-0011) or a max players value. A game may have no modes.
- Given that I am a system admin, when I save a mode with game roles, then its max players is the sum of its role slots, and I do not enter max players separately.
- Given that I am a system admin, when I save a mode without game roles, then max players is required: a whole number of at least 1. A mode is never unlimited, so a cleared value is denied with an error message and no change is saved (DECISION, user, 2026-11-08).
- Given that I am a system admin, when I enter a role slot number for a game role of a mode, then any whole number of at least 1 is accepted, with no upper bound of its own. The mode's max players is the sum of its slots and has the same limit as any max players value: no product cap, and the technical upper bound of REQ-0009 (DECISION, user, 2026-11-08).
- Given that I am a system admin, when I save a mode with an empty name, a name longer than 50 characters, or a name that another mode of the same game already has (ignoring case and surrounding spaces), then it is denied with an error message and no change is saved.
- Given that I am a system admin, when I add an activity to a mode, then I enter a name of 1–50 characters, unique within that mode (ignoring case and surrounding spaces). A mode may have no activities.
- Given that I am a system admin, when I save an activity with an invalid or duplicate name, then it is denied with an error message and no change is saved.
- Given that a game has at least one mode, when I look at the game's form, then the game's own default max players and game roles (REQ-0009, REQ-0011) are not offered. If the game had them before its first mode was saved, they are no longer used by new lobbies (DECISION, user, 2026-11-08). Lobbies created before keep their values until a mode is set (see "Changed or removed modes and activities"). They apply again when the last mode is removed (DECISION, user, 2026-11-08).
- Given that I am a system admin, when I add or change a mode or activity, then no other field is asked for.
- Given that I am a system admin, when I remove a mode or activity, then I must confirm first, as in REQ-0010 (ASSUMPTION, see Assumptions).
- Given that I am a group admin or a member in a group, when I try to add, change or remove a mode or activity, then it is denied and nothing is changed.
- Given that I am a system admin, when I try to add a mode or activity to "Other", then it is denied (see "Other" below).
- Given that a game has several modes or activities, when a member chooses one, then they are shown in the order the system admin entered them (DECISION, user, 2026-11-08).

Creating a lobby (extends REQ-0003):
- Given that I am a member, when I open the create form, then game, mode and activity are each optional. The mode choice shows only the modes of the chosen game, and the activity choice shows only the activities of the chosen mode.
- Given that I choose a game without modes, when I select it, then max players and game roles are filled in as in REQ-0009 and REQ-0011.
- Given that I choose a mode, when I select it, then max players is filled in from the mode, and for a mode with game roles its role slots are filled in as in REQ-0011.
- Given that I choose a mode and no activity, when I save, then the lobby is saved with the mode and without an activity.
- Given that I choose a mode and an activity of that mode, when I save, then the lobby is saved with both.
- Given that I choose no game, when I save, then the lobby is saved as an open lobby (see "Open lobbies" below). The time rules of REQ-0003 still apply.
- Given that the service receives an activity without a mode, or an activity that does not belong to the chosen mode, or a mode that does not belong to the chosen game, then it is denied with an error message and no lobby is saved. The form prevents these choices; the service must still check them.
- Given that I have saved a lobby with a game and a mode, when another member opens it, then they see the same game, mode and activity (as in REQ-0009 for the game).
- Given that I create a lobby with a mode that has game roles, when it is saved, then the creator choice of game role or flex applies as in REQ-0011.

Open lobbies (new, F-034):
- Given that I create a lobby with no game, when I save it, then it is saved with no game, no mode and no activity, it is shown as "Open", and the time rules of REQ-0003 apply.
- Given that I create a lobby with a game and no mode, when I save it, then it is shown with the game name only, e.g. "WoW".
- Given that I create a lobby with no mode, when I enter max players, then the value is saved. Max players is optional; empty means no limit (DECISION, user, 2026-11-08). If the game has no modes and has a default max, that default is filled in as in REQ-0009.
- Given that a lobby has no mode, when I join or leave, then REQ-0005 applies. No mode or activity is asked for. A game role choice is asked only if the lobby has game roles (REQ-0011, Amendment 2026-11-08).
- Given that a lobby has no game, when it is shown, then it has the neutral genre theme (REQ-0014) and it does not count toward the "most used first" order (REQ-0009).
- Given that a lobby has a game but no mode, when it is shown in the "most used first" order, then it counts toward its game (REQ-0009).

Setting or changing the game, mode or activity later:
- Given that I am a player of a lobby that has no game, when I choose a game, then it is saved, and max players and role slots stay as they are (DECISION, user, 2026-11-08: choosing a game after creation does not change max players; the role slots stay too, because they make up max players; see "Applying a choice" below).
- Given that I am a player of a lobby that has a game (including "Other"), when I try to change or remove the game, then it is denied and nothing is changed (DECISION, user, 2026-11-08: a game cannot be changed once it is set).
- Given that I am a player of a lobby with a game that has modes, when I choose a mode of that game, then it is saved, and the mode's limit applies as in "Applying a choice" below.
- Given that I am a player of a lobby with a mode, when I choose another mode of the same game, then it is saved, and the new mode's limit applies as in "Applying a choice" below (DECISION, user, 2026-11-07).
- Given that I am a player of a lobby with a mode, when I try to remove the mode, then it is denied and nothing is changed (DECISION, user, 2026-11-08: a mode cannot be cleared once it is set).
- Given that I am a player of a lobby with a mode, when I change the mode, then the activity is cleared, because an activity belongs to its mode (DECISION, user, 2026-11-08).
- Given that I am a player of a lobby with a mode that has activities, when I choose an activity of that mode, then it is saved. This changes neither the players nor the limit.
- Given that I am a player of a lobby, when I clear its activity, then it is saved and the lobby keeps its mode (DECISION, user, 2026-11-08, question 5: an activity may be cleared on its own).
- Given that I am a member of the group but not a player of the lobby, when I try to set or change the game, mode or activity, then it is denied and nothing is changed (DECISION, user, 2026-11-08: only players of the lobby may change them).
- Given that I am not a member of the group, when I try to set or change the game, mode or activity, then it is denied (REQ-0005).
- Given that the lobby has passed its end time, when I try to set or change the game, mode or activity, then the lobby is shown as "Ended" and nothing is saved (REQ-0005, DECISION, user).
- Given that the creator has deleted the lobby, when I try to set or change anything, then it is denied with the message "The lobby no longer exists" (REQ-0005).
- Given that a mode or activity has been removed from the game list, when I try to choose it, then it is not offered. If my save still reaches the service, it is denied with an error message.

Applying a choice (mode, after creation; at creation the creator's prefilled and typed values apply, see the last criterion of this section; a game chosen after creation changes neither, see "Setting or changing ... later"):
- Given that I choose, after creation, a mode, when the choice is saved, then the lobby's max players becomes the mode's limit (for a mode with game roles, the sum of its slots), and its role slots become those of the chosen mode. Choosing a mode is the only way max players changes after creation (DECISION, user, 2026-11-08).
- Given that I choose a mode, when the new limit is lower than the number of players in the lobby (players of game roles and flex players count together), then the choice is denied with an error message ("The lobby has more players than this mode allows") and nothing is changed (DECISION, user, 2026-11-08).
- Given that the lobby has players and the mode I choose has game roles, when the change is saved, then every existing player is a flex player (DECISION, user, 2026-11-08). The total number of players does not change. Each player may then choose a game role with a free slot (REQ-0011).
- Given that the lobby has players and the mode I choose has no game roles, when the change is saved, then the players keep their spots without a game role. The total does not change.
- Given that I choose the mode the lobby already has, when I save, then nothing changes.
- Given that I create a lobby, when I change the prefilled max players or role slots before saving, then the lobby keeps my values (REQ-0009, REQ-0011). After creation, a change of mode sets max players and role slots to the mode's values, which replaces the values the creator typed (DECISION, user, 2026-11-08; this is an exception to F-018 and REQ-0003, see Related features).

Concurrency:
- Given that two players set or change the mode of the same lobby at the same time, when both are saved, then at most one change is saved. The other is denied with an error message that the lobby has changed, and the lobby shows the saved mode after a reload. No change is applied partly.
- Given that a member joins a game role at the same time as a player changes the mode so that this game role no longer exists, when both are saved, then the result is one of the two in a single order. The join is denied if the mode changed first, and no player status is saved for a game role that the lobby no longer has.
- Given that a mode change and a join reach the last free spot at the same time, when both are saved, then at most one succeeds, and neither the number of players nor a game role's count ever exceeds its limit (REQ-0005, REQ-0011).

Display (extends REQ-0004, REQ-0011, REQ-0012 and REQ-0014):
- Given that a lobby has a game, when I see it in a lobby list, under Next up or This week, or as a block in the week view, then its label is the game, the mode and the activity, separated by " › ", e.g. "WoW › Dungeon › <activity>". A missing mode or activity is left out: "WoW › Dungeon" or "WoW".
- Given that a lobby has no game, when I see it in any of these views, then its label is "Open".
- Given that a lobby is an "Other" lobby, when I see it, then its label is the free-text name only (no mode and no activity).
- Given that a lobby has a mode, when I see its player count, then it is shown as "X/Y players" with Y from the mode. For a mode with game roles, the game role display of REQ-0011 applies.
- Given that a lobby has a mode, when I open the lobby page, then the label is shown, and the player count and the game role display of REQ-0011 are shown. The lobby page shows the mode and activity as text.
- Given that a lobby is a block in the week view and the block is too small for the full label, when I see the block, then the game name is shown in full as text (REQ-0004, REQ-0014), the mode and activity may be truncated, and the full label is available to assistive technology (ASSUMPTION, as in REQ-0004).
- Given that a lobby has a game with a genre, when I see it, then it shows the genre theme (REQ-0014). Modes and activities have no theme of their own. A lobby without a game shows the neutral theme.
- Given that a lobby has a label with a mode, when I see it with the genre theme of its game, then the label is text, so it can be read without the color (REQ-0014).

Changed or removed modes and activities (same rule as REQ-0009 and REQ-0010):
- Given that a system admin has removed a mode, when a lobby already uses it, then the lobby keeps its mode name, its activity name, its role slots, its max players and its players. The mode is no longer offered for new lobbies or for changes.
- Given that a system admin has removed an activity, when a lobby already uses it, then the lobby keeps the activity name it was saved with.
- Given that a system admin has renamed a mode or activity, when a lobby already uses it, then the lobby shows the name it was saved with. Each mode and activity has a system-generated identity that never changes (REQ-0009, REQ-0010).
- Given that a system admin has changed the role slots or max players of a mode, when a lobby already uses it, then the lobby keeps its values. Only lobbies created or changed after the change take the new values.
- Given that a system admin has removed a game, when a lobby uses it, then the lobby keeps its game, mode and activity labels and its players (REQ-0009).
- Given that a game gets its first mode, when a lobby of that game was created before without a mode, then the lobby stays an open lobby with no mode and keeps its max players, its role slots and its players' game roles. Joining and changing follow REQ-0005 and REQ-0011 for those role slots. Its values change only when a mode is set (DECISION, product owner, 2026-11-08: no player is moved or dropped when a game gets its first mode).
- Given that a system admin has removed the last mode of a game, when I create a lobby with that game and no mode, then the game's own default max players and game roles apply again, as in REQ-0009 and REQ-0011 (DECISION, user, 2026-11-08). Existing lobbies keep their values.

"Other" (free-text game):
- Given that I choose "Other" as the game when I create a lobby, then no mode and no activity are offered, and max players and genre are as today (REQ-0009, REQ-0014).
- Given that a lobby has "Other", when a player tries to set a game or a mode, then it is denied and nothing is changed, because "Other" counts as a game that is already set.
- Given that I am a system admin, when I add a mode or an activity to "Other", then it is denied, because "Other" is reserved and has no modes (REQ-0010).

## Out of scope
- More than one game, mode or activity in one lobby, e.g. "Dungeon and raid this week". One lobby has at most one game, one mode and one activity.
- Modes or activities added, proposed or changed by members or group admins, and group-specific lists (REQ-0009, REQ-0010).
- A genre per mode or per activity. The genre stays per game (REQ-0014).
- Activity limits or game roles of their own. An activity takes the limit and roles of its mode.
- Changing the game of a lobby once it has one (DECISION, user, 2026-11-08).
- Clearing a mode once it is set (DECISION, user, 2026-11-08).
- Editing max players or role slots directly after creation, apart from the rule "Applying a choice" (F-011).
- Suggesting a mode or activity from the time, from the group's history, or from the players.
- Matching players to a mode, an activity or a game role (REQ-0011).
- Reading game state or using the games' own systems (vision.md).
- Notifications when a mode or activity is chosen or changed (F-015).
- Recurring lobbies (F-014).
- Translation of mode or activity names. They are data entered by the system admin, like game names (F-026).

## Related features
F-027 (Game roles and role slots, REQ-0011): game roles may sit on a mode as well as on a game without modes. This extends F-027 and is not a duplicate. REQ-0011 is amended in this same change (see Amendments below). The rules for flex and for the role choice are REQ-0011's and stay as they are.

F-024 and F-025 (game list and its management, REQ-0009 and REQ-0010): modes and activities are new data per game, entered in the same game form of F-025. REQ-0009 excludes more fields per game than name, default max and genre. This requirement lifts that exclusion for modes and activities, the same way REQ-0011 lifts it for game roles. It is not a second place to manage games.

F-003 (Create lobby): the game becomes optional, and a mode and an activity are added. This extends F-003. The time rules and the creator as a player stay as in REQ-0003.

F-005 (Join and leave lobby): join and leave rules are unchanged. A mode change can make existing players flex (see "Applying a choice"). REQ-0005 stays the rule for joining, leaving, end time and concurrency.

F-018 (Max players per lobby): a mode gives the max players of a lobby. Changing the mode after creation changes max players, which F-018 and REQ-0003 otherwise do not allow. This is an exception decided by the user (DECISION, user, 2026-11-08). Choosing a game after creation does not change max players (DECISION, user, 2026-11-08).

F-011 (Edit existing lobby, Proposed): this requirement is not F-011. Only the game, the mode and the activity can be set or changed later, and max players and role slots follow them. General editing of a lobby stays Proposed.

F-021 ("Maybe" reply, Proposed): an open lobby is a bookable time that members join like any other lobby. It is not a third reply state on a lobby, so it is not a duplicate of F-021.

F-004, F-017, F-028 (lobby lists, week view, Dashboard) and F-032 (genre themes): these views show the new label. This is presentation of those features, not a new feature in them. The genre theme follows the game (REQ-0014), so a mode has no theme of its own.

F-030 (Game presentation: logo and accent color): no interaction in this requirement. The per-game accent color, when built, follows the game as before.

## Amendments to other requirements (decided 2026-11-08, pending implementation)
Each amendment is written in the requirement it changes, marked "Amendment 2026-11-08 (REQ-0015)", with the replaced wording kept as "Old wording".
- REQ-0003: the game is optional; the open lobby criteria replace "game is mandatory"; mode and activity are added to the form; max players is prefilled from the mode. F-018 exception recorded.
- REQ-0009: the game list has modes and activities as new fields; game-level default max and game roles apply only to games without modes; lobbies without a game do not count toward the "most used first" order.
- REQ-0010: the game form also manages modes and activities; "Other" has no modes.
- REQ-0011: game roles may be defined on a mode (see the amendment at the end of REQ-0011).
- REQ-0004, REQ-0012 and REQ-0014: the label "game › mode › activity" or "Open" is shown in their views; a lobby without a game shows the neutral theme.
- F-018: the mode change is an exception to "max players does not change after creation" (DECISION, user, 2026-11-08).

## Decisions
- DECISION (user, 2026-11-07, point 1): Mode plus named activity. A game can have modes. Each mode can list named activities. The lobby creator picks one, or just the mode. The system admin maintains the lists in the game list (REQ-0010).
- DECISION (user, 2026-11-07, point 2): Roles per mode. Each mode has its own role slots, and its max players is their sum. A game without modes has roles directly on the game, as REQ-0011 says.
- DECISION (user, 2026-11-07, point 3): Open lobby, both kinds. Game and mode are both optional. A lobby can be only a time, or a game with no mode. Either can be set later.
- DECISION (user, 2026-11-07, point 4): All players of the lobby, not only the creator, may set or change the mode, and set the game for a lobby without a game, later.
- DECISION (user, 2026-11-08, question 1): A mode change after creation changes max players and role slots. This is an exception to F-018 and REQ-0003.
- DECISION (user, 2026-11-08, question 2): A mode change is denied if the lobby has more players than the new limit.
- DECISION (user, 2026-11-08, question 3): On a mode change to a mode with game roles, all existing players become flex.
- DECISION (user, 2026-11-08, question 4): Only players of the lobby may set or change the game, mode and activity.
- DECISION (user, 2026-11-08, question 5): A game cannot be changed once it is set. A mode cannot be cleared once it is set. Changing the mode clears the activity. An activity may be cleared on its own.
- DECISION (user, 2026-11-08, question 6): In an open lobby, max players is optional; empty means unlimited.
- DECISION (user, 2026-11-08, question 7): A mode always has a limit, either role slots or max players.
- DECISION (user, 2026-11-08, question 8): A game with modes has no game-level default max or game roles.
- DECISION (user, 2026-11-08, question 9): "Open lobby" means a lobby with no mode. A lobby with no game shows "Open".
- DECISION (user, 2026-11-08, question 10): A mode change replaces the role slots the creator typed with the mode's defaults.
- DECISION (user, 2026-11-08, question 11): Modes and activities are shown in the order the system admin entered them.
- DECISION (user, 2026-11-08, decisions 1, 2, 4): See "Amendment 2026-11-08 (user decisions 1, 2 and 4)": last mode removed restores the game's own max and game roles; a mode is never unlimited; role slots have no upper bound of their own.
- DECISION (user, 2026-11-08, question 12): REQ-0011 and REQ-0015 are delivered together, after REQ-0014 (backlog A1). The open-lobby slice alone is not built first.
- DECISION (user, 2026-11-08, game choice): Choosing a game after creation does not change max players. Max players changes after creation only when a player sets or changes the mode.
- DECISION (product owner, 2026-11-08, first mode of a game): A lobby created before its game got its first mode keeps its max players, role slots and players' game roles until a mode is set. No player is moved or dropped when the game gets its first mode. The user did not address this case; the product owner chose the simplest rule that does not drop players silently.
- DECISION (product owner, within point 1): An activity belongs to exactly one mode, and a lobby has at most one activity.
- DECISION (product owner, within point 2): A mode always has a limit, either its game roles or a max players value (confirmed by the user, 2026-11-08).
- DECISION (product owner, within point 2): A game with modes does not use its own default max or game roles. Its lobbies get their limit from the mode they choose (confirmed by the user, 2026-11-08).

## Assumptions
Not among the twelve questions answered on 2026-11-08. They are the product owner's defaults and stand unless the user overrules them.
- ASSUMPTION (confirmation on removal): Removing a mode or activity asks for confirmation, as removing a game does in REQ-0010.
- ASSUMPTION (activity name length): Activity names are 1–50 characters, as game names are (REQ-0010).
- ASSUMPTION (label separator): The label separator " › " and the "Open" wording are set here as examples; the exact copy belongs to the UI expert within these rules and the UI text catalog.
- ASSUMPTION (change control): The game, mode and activity are changed on the lobby page only. The lists, the week view and the Next up card show them but do not change them (REQ-0004 and REQ-0012 amendments). For the UI expert to confirm.
- ASSUMPTION (last mode removed): Decided 2026-11-08 by the user, no longer an assumption. See "Amendment 2026-11-08 (user decisions 1, 2 and 4)".

## Amendments of REQ-0011 (see REQ-0011 for the text in place)
- Game roles may be defined on a mode of a game instead of on the game. A game with modes has no game roles of its own.
- Max players of a mode with game roles is the sum of its slots, as for a game (DECISION, user, point 2).
- Role slots of a lobby are prefilled from its mode (or its game). The creator may change them at creation, as REQ-0011 says. After creation they follow the mode (see "Applying a choice").
- A mode change makes existing players flex when the new mode has game roles (DECISION, user, 2026-11-08).
- A lobby created before its game got its first mode keeps its role slots and its players' game roles until a mode is set (DECISION, product owner, 2026-11-08). Then the rules of "Applying a choice" apply.
- Choosing a game after creation does not change max players or role slots (DECISION, user, 2026-11-08 for max players; see "Applying a choice").

## Amendment 2026-11-08 (user decisions 1, 2 and 4)
Status stays Decided. The three decisions are written in the criteria named below; this section records them and the replaced wording.
- DECISION (user, 2026-11-08, decision 1): After a game's last mode is removed, the game's own default max players and game roles apply again to new lobbies with that game and no mode. Existing lobbies keep their values. Was: ASSUMPTION (last mode removed). Criterion: "Changed or removed modes and activities".
- DECISION (user, 2026-11-08, decision 2): A game mode is never unlimited. A mode without game roles must have a max players value (a whole number of at least 1). A cleared value is denied with an error message and nothing is saved. Criterion: "Modes and activities", the save of a mode without game roles.
- DECISION (user, 2026-11-08, decision 4): Role slots have no upper bound of their own, beyond the normal max players limit. The sum of a mode's or game's slots is its max players and has no product cap (technical upper bound as in REQ-0009). Criterion: "Modes and activities", the role slot number of a game role of a mode.
- DECISION (user, 2026-11-08, decision 3): Game role names are unique per owner, not per game. This is recorded in REQ-0011 (Amendment 2026-11-08, game role names per owner) and affects REQ-0015 only through "Game role" on a mode.

## Glossary proposal (new terms: Game mode, Named activity, Open lobby, Label; for the architect to add to CLAUDE.md, not yet added)
- **Game mode** (`game_modes`, `gameModes`, `modeId`): a kind of play within a game, with its own limit (role slots or max players), e.g. "Dungeon" or "Raid". Entered by a system admin. Avoid: type, category, difficulty, queue, playlist.
- **Named activity** (`activities`, `activityId`): a specific thing played within a mode, e.g. a particular dungeon. Optional, one per lobby. Avoid: instance, content, map, boss, target.
- **Open lobby** (no `modeId`; a lobby with no game has no `gameId`): a lobby without a mode, either with no game or with a game and no mode. Shown as "Open" when it has no game. Avoid: free lobby, unnamed lobby, drop-in.
- **Label** (UI only, no API field): the text "game › mode › activity", or "Open", that a lobby shows in lists, Next up, This week and on its page. Avoid: title for this purpose, since a lobby has no title field.
- Note: "activity" also appears in ADR 0007 in the sense of a permission check order. This is not a conflict, but the architect should decide whether the glossary term is used in code names where that might confuse.
- Note: the glossary term "Game role" (REQ-0011) also applies to a game role on a mode. Its technical form may move from the game to the mode.
