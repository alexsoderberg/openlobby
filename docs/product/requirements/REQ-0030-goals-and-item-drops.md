# REQ-0030. Goals and item drops (World of Warcraft: Forever first)
Status: Decided
Feature: F-031 (EXTEND, not a new feature)
Priority: Should

Decided by the user, 2026-11-23 to 2026-11-25 (conversation, written down in Swedish; these notes are in English). The user's decisions are marked DECISION. Where the product owner filled a detail the user did not address, it is marked ASSUMPTION and the user may override it. All open questions were answered by the user on 2026-11-25 (see Decisions).

This requirement replaces the reasoning of F-031 "Proposed" (2026-11-04), which postponed the idea and did not recommend an item database. The user has now decided to build it with item IDs only and no item database of our own (DECISION, user, 2026-11-24). See Decisions.

## Problem
A member of a group that plays a dungeon or raid in a game often wants one specific item that drops there, e.g. a shield for the tank or a dagger for the rogue. Today nobody in the group can see who wants what, so the lobby cannot show who is likely to get which drop, and the member has no place to keep the wish. In World of Warcraft: Forever (released 2026-11-04, levels 1 to 60, nine dungeons and three raids per the official information) the members of the user's group want to see this on the lobby page.

## User story
As a member I want to record the items I want from the dungeons and raids of a game, so that the lobby page shows which players want an item that drops in the dungeon or raid of that lobby.

## Terms used in this requirement
- **Goal**: one item that a member wants from one game. Owned by one member, one set for all groups (as Preferred game role). Avoid: wish, wish list, want, target.
- **Drop list**: the items that can drop in one Named activity (a dungeon or a raid), entered by the system admin. Avoid: loot table, loot list.
- **Item**: a game item, identified only by its Blizzard item ID. The app stores no name, icon or other copy of it. Avoid: gear, loot, reward.
- **Item icon**: the picture of an item, fetched from Blizzard when shown (not stored by us beyond the short cache of ADR 0029 section 4, under 30 days).
- **Attribution**: the text "Data from Blizzard", shown where item names or icons are shown.
- **Unknown item**: an item ID that Blizzard does not return (not found). Shown with its ID.

Named activity (REQ-0015, `activities`) is the dungeon or raid. A Game mode of the game is the kind of play ("Dungeon", "Raid"). The drop list belongs to the Named activity.

## Acceptance criteria

Drop list (system admin; in the game form of REQ-0010, under each Named activity, extends REQ-0015):
- Given that I am a system admin and a Named activity of a game, when I add an item by its Blizzard item ID, then the item is on the activity's drop list, and the item's name and icon are shown from Blizzard when Blizzard answers.
- Given that I am a system admin, when I enter an item ID that is not a whole number of at least 1, then it is denied with an error message and nothing is saved.
- Given that I am a system admin, when I enter an item ID that is already on the same drop list, then it is denied with an error message and nothing is saved.
- Given that I am a system admin, when I enter an item ID that Blizzard answers as not found, then the form shows that Blizzard does not know this ID, and I can still save it, shown as "Unknown item" with its ID (DECISION, user, 2026-11-25).
- Given that I am a system admin, when I enter an item ID and Blizzard does not answer, then the item is saved and shown with its ID and "Name not available" (see the fallback criteria below).
- Given that I am a system admin, when I remove an item from a drop list, then I must confirm first (ConfirmDialog, as in REQ-0010), and after confirming the item is no longer on that drop list.
- Given that I am a system admin, when I remove an item from a drop list, then the goals of members for that item are kept (see Goals).
- Given that I am a system admin, when I remove a Named activity, then its drop list is removed with it.
- Given that I am a group admin or a member, when I try to add or remove a drop-list item, then it is denied and nothing is changed (as REQ-0015).
- Given that a drop list has several items, when a member sees it, then the items are shown in the order the system admin entered them (as REQ-0015).
- Given that I am a system admin, when I add a drop-list item, then no other field is asked for.

Item data (shown wherever item names or icons are shown: You page, lobby page, drop list in the game form):
- Given that an item is shown, when Blizzard answers, then its name and icon are shown from Blizzard.
- Given that an item is shown, when Blizzard answers "not found", then the text "Unknown item" and the ID are shown, with no icon, and the page works.
- Given that an item is shown, when Blizzard does not answer (down, slow, or the limit of its API is reached), then the text "Item" with the ID and "Name not available" are shown, with no icon, and the page works. No error page is shown.
- Given that item names or icons are shown, when I see the page, then the attribution "Data from Blizzard" is shown once on that page, next to the items.
- Given that a name or icon was taken from Blizzard, when 30 days have passed since it was taken, then it is no longer kept by us; the next view takes it again (Blizzard's API terms, 30 days maximum).
- Given that the app stores data for an item, when I look at what is stored, then only the item ID and our own links (game, activity, member) are stored; no item name, icon or description is stored beyond the 30-day cache.

Goals (You page; extends REQ-0020 and REQ-0021):
- Given that I am logged in, when I open the You page, then I see a section "Goals" between "Game roles" and "System admin" (it is shown to every signed-in member, as "Game roles" is, REQ-0021).
- Given that I open the "Goals" section, when a game has at least one drop list with items, then the section shows that game with my goals for it and an "Add goal" control. A game with no drop-list items is not shown.
- Given that I choose "Add goal" for a game, when I type a text, then I see the items of that game's drop lists whose name contains the text (ignoring case). Each result shows its icon, its name and the dungeons or raids it drops in (DECISION, user: search per game and per dungeon or raid).
- Given that I choose "Add goal" for a game, when I narrow the search to one dungeon or raid, then only the items of that drop list are shown (DECISION, user, 2026-11-25).
- Given that Blizzard does not answer, when I search, then the items of the drop lists are still listed by their ID with "Name not available", and I can add any of them as a goal. Only the name search does not work then, and the page says so.
- Given that I choose an item in the search results, when I confirm it, then it is added to my goals for that game, and the success is confirmed as a toast (REQ-0022 rule for successful actions).
- Given that the item is already one of my goals for that game, when I choose it, then it is not added twice and I see that it is already in my goals.
- Given that I have goals, when I choose to remove one, then it is removed from my goals at once and the success is confirmed as a toast; no confirmation is asked (DECISION, user, 2026-11-25).
- Given that I have goals for a game, when I am a member of several groups, then the same goals apply in all of them (DECISION, user, one choice for all groups, as REQ-0021).
- Given that I have goals for a game, when I look at them, then they are one list for the game, not one list per dungeon or raid, and each goal shows the dungeons or raids it drops in (DECISION, user, 2026-11-25).
- Given that an item of my goals is no longer on any drop list of its game, when I open my goals, then the goal is still listed with its name or fallback, and I can remove it.
- Given that a system admin removes a game, when I open my goals, then the goals of that game are not shown and are not matched in any lobby (ASSUMPTION).
- Given that I open the You page, then I see only my own goals. Other people's goals are not shown on the You page.

Lobby page (new; extends REQ-0015 and REQ-0021):
- Given that a lobby has a Named activity with a drop list, when I open its lobby page, then next to each player whose goal is on that drop list, the matching items are shown with their names or fallback and icons (DECISION, user: shown next to the player).
- Given that a player has goals that are not on the lobby's drop list, when I open the lobby page, then those goals are not shown.
- Given that a lobby has no Named activity, or its Named activity has no drop list, when I open the lobby page, then no goals are shown.
- Given that a player has no goal on the drop list, when I open the lobby page, then nothing is shown next to that player.
- Given that I am not a member of the lobby's group, when I try to open its lobby page, then I cannot see it, and so I cannot see the goals (REQ-0005, REQ-0021).
- Given that a lobby's activity is changed to one with another drop list, when I open the lobby page, then the goals are matched against the new drop list (the activity is the current one, REQ-0015).

Member list and other places (not in this delivery):
- Given that I open the member list of a group, then no goals are shown (the full list is too much information, DECISION, user).

Blizzard limits and cache (product rules; the architect designs the mechanics):
- Given that many members use the app at the same time, when item names are needed, then the app stays within Blizzard's limit of 36,000 calls per hour (ASSUMPTION; the architect sets the cache and its size).
- Given that the app calls Blizzard, when the call is for a game, then it uses a pinned version of Blizzard's data where Blizzard offers one, with a fallback and a warning in the log when the pinned version is gone. Deviation accepted by the user (DECISION, user, 2026-11-25; see ADR 0029 section 5): the first delivery uses the Forever namespace as a configuration value with its alias, because no build-stamped namespace is verified for Forever. A guard answers "unavailable" and logs a warning after a streak of not-found answers. A verified build-stamped namespace is added later. The region is eu (`BLIZZARD_REGION`, DECISION, user, 2026-11-25).

## Out of scope
- Games other than World of Warcraft: Forever. Other games and other kinds of goals (e.g. reaching a rank) come later, as new kinds added to F-031.
- Marking a goal as obtained, or any loot history. Later (user, 2026-11-24).
- Assigning an item to a player, or any loot rule ("who gets the shield"). Not decided, not in the first delivery.
- Matching goals to a game role (tank, rogue). A player's role is not used to find goals (REQ-0011 excludes matching).
- Members adding, proposing or changing drop-list items (only the system admin, REQ-0015 and REQ-0010).
- An automatic drop list from Blizzard's Forever Journal. Later, when the journal has the data (DECISION, user, 2026-11-25). The journal is empty on 2026-11-24.
- A database of items of our own (names, descriptions, copies of icons). Not stored (DECISION, user, 2026-11-24).
- Searching Blizzard's whole item catalogue. Search is among the items of the drop lists only.
- The goals of other people on the You page or a profile page. Profiles of other people are not a feature yet (later idea).
- Goal notifications, or a notice when a goal's item drops (F-015).
- Translations of item names. Item names are English, also when the app gets Swedish (DECISION, user, 2026-11-25).
- Goals in the member list, including a single "top priority" item (not now; possibly a later requirement, DECISION, user, 2026-11-25).

## Related features
- F-031 (Per-player item goals, Proposed on 2026-11-04): this requirement is that feature. It is EXTEND F-031, not a new feature, and the feature becomes Decided with this requirement. Its open questions (a) per-session or standing wish list, (b) free text or item database and (c) visibility are answered in Decisions. Its statement "an item database is not recommended" is replaced by the user's decision of 2026-11-24: no item database of our own, IDs and links only.
- F-039 and REQ-0021 (Preferred game roles per member): the same kind of standing choice per member, one set for all groups, shown to the members of the groups the member shares. Goals follow the same visibility rule: the lobby page shows them to members of the lobby's group, and nowhere else in this delivery.
- REQ-0015 (Game modes, named activities): the Named activity is the dungeon or raid that a drop list belongs to. No new kind of play, no new term for a dungeon or raid.
- REQ-0010 (Manage game list as system admin): the drop list is entered in the game form, next to the Named activity. This extends REQ-0010 and is not a second place to manage games.
- REQ-0020 (Account settings panel): the "Goals" section is one more section of the You page, between "Game roles" and "System admin".
- F-030 and REQ-0026 (Game logo): the game logo is an image the system admin uploads and we store. An item icon is a picture from Blizzard that we fetch and do not store. They are not the same thing, and this requirement does not change the Game logo.
- F-040 (Personal todo list, Rejected or postponed): a list of goals is not a todo list. It is about game items, and it is shown to the group in a lobby.
- F-027 and REQ-0011 (Game roles and role slots): no change. A goal is not a role slot.
- REQ-0022 (Toasts for confirmations): adding and removing a goal are two more places of its rule for successful actions. This extends REQ-0022's list (EXTEND, no new feature).
- REQ-0029 (Redesign): the You page and the lobby page are shown in the redesigned form. The Goals section and the lobby page goals follow it.

## Decisions
- DECISION (user, 2026-11-23): first game is World of Warcraft: Forever. Other games later.
- DECISION (user, 2026-11-23): raids are included from the start, not only dungeons. The kind of play (Dungeon, Raid) comes from the game's modes.
- DECISION (user, 2026-11-23): the drop list must be complete for the user; members do not fill the database.
- DECISION (user, 2026-11-23): items are searchable, with their image.
- DECISION (user, 2026-11-24): store only Blizzard item IDs and our own links, never copies of items or dungeons as our own entities. Names and icons are fetched from Blizzard when shown and kept only in a short cache under 30 days.
- DECISION (user, 2026-11-24): a goal is a member plus a Blizzard item ID (and the game, so that goals of two games do not mix). A drop list is a Named activity plus Blizzard item IDs. Search is among the items of the drop list.
- DECISION (user, 2026-11-24): a missing item (not found) is shown as "Unknown item" with its ID.
- DECISION (user, 2026-11-24): the Blizzard Game Data API is the data source.
- DECISION (user, 2026-11-24): goals are shown on the lobby page next to the player when the lobby's activity has the item in its drop list.
- DECISION (user, 2026-11-24): the full goal list is not shown in the member list.
- DECISION (user, 2026-11-24): the attribution "Data from Blizzard" is shown where item data is shown.
- DECISION (user, 2026-11-24): a single "top priority" item in the member list is wanted only "if anything". It is treated as a Could for later, not in this delivery, and not ordered. Answered 2026-11-25: not now, possibly a later requirement.
- DECISION (user, 2026-11-25): the system admin enters the drop lists by hand for now, by Blizzard item ID. Blizzard's data replaces this when the Forever Journal has it.
- DECISION (user, 2026-11-25): the vision line on game integration reads: item names and icons may be read from the publisher's public game data API for display only. Never game state (characters, progress), and no sync. vision.md carries this as a DECISION line.
- DECISION (user, 2026-11-25): goals are added per game. The search can be narrowed to one dungeon or raid, and each goal shows the dungeons or raids where it drops. One list per game, not one per dungeon or raid.
- DECISION (user, 2026-11-25): the system admin may save an item ID that Blizzard does not know; it is shown as "Unknown item" with its ID.
- DECISION (user, 2026-11-25): item names are English, also when the app gets Swedish. No Swedish item names are planned.
- DECISION (user, 2026-11-25): removing a goal is immediate, with no confirmation.
- DECISION (user, 2026-11-25): the architect decides alone whether storing only item IDs and our own links is allowed under Blizzard's 30-day storage rule. If the answer is no, the orchestrator brings it back to the user. Until then the product rules above stand as written.
- DECISION (user, 2026-11-25): drop lists are only as complete as the system admin enters them, until Blizzard's Forever Journal has the data. Accepted.
- ASSUMPTION (product owner): a goal has no maximum number.

## Priority and order
Should. Placed in `backlog.md` as A3j, after A3i (game cover removal, which must come first) and before A4 (Discord avatars). The user asked for it now. The user may move it earlier.

## Open questions
None open. All eight questions of 2026-11-25 are answered (see Decisions). The 30-day rule is answered by the architect: yes, with conditions C1 to C4 (ADR 0029 section 1, Accepted 2026-11-25; DECISION, user, 2026-11-25, architect decides alone).
