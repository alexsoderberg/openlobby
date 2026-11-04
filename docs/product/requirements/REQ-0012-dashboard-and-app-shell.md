# REQ-0012. Dashboard and app shell
Status: Decided
Feature: F-028
Priority: Must

## Problem
After login a member has no overview across their groups. To see whether anyone is playing tonight, they must open each group. Group views are not part of one layout, so moving between groups and creating a group are not reachable from one place. Phones are the main way friends check in, and the app is not designed for them yet.

## User story
As a member, I want to land on a dashboard with Next up and This week across all my groups, and move between the dashboard and my groups from one navigation, so that I see at a glance when we can play and reach any group in one tap.

## Acceptance criteria

Dashboard (F-028):
- Given that I am logged in, when I open `/`, then the dashboard is shown as the home screen, not the group list (DECISION, user; ADR 0014, point 6).
- Given that my groups have upcoming lobbies, when the dashboard opens, then the "Next up" card shows the lobby that starts first among all lobbies of my groups, with date, clock time, countdown, game, group name and Spot / max players ("3/5 players", or "3 players" when the lobby has no max players). The card shows no player names (DECISION, user; ADR 0014, point 3).
- Given that the Next up lobby has not started, when the card is shown, then the countdown has this structure: "in 2 d 3 h" when 1 day or more remains, "in 3 h 12 min" when 1 hour or more remains, "in 12 min" when 1 minute or more remains, and "in under a minute" below that. Values are rounded down. The exact copy is the UI expert's within this structure (ASSUMPTION).
- Given that the next lobby has started but not ended, when the card is shown, then it shows "Running" instead of the countdown (ASSUMPTION).
- Given that the dashboard is open and the Next up lobby reaches its end time, when the time passes, then the card shows "Ended" instead of "Running" until the page is reloaded. After a reload the ended lobby is no longer listed, and the next lobby is shown as Next up (ASSUMPTION; same rule as REQ-0005 for a lobby that ends while the view is open).
- Given that REQ-0005 is not yet delivered, when the Next up card is shown, then it has no "Join lobby" or "Leave lobby" button (DECISION, user, 2026-11-04).
- Given that REQ-0005 is delivered, when I click "Join lobby" or "Leave lobby" on the card, then REQ-0005 applies, including full and "Ended". The card's button state needs `joinedByMe` on `Lobby` (ADR 0014, point 5); that field is delivered with REQ-0005, not with this requirement.
- Given that my groups have lobbies, when the dashboard opens, then "This week" lists every lobby that has not ended yet and whose time overlaps Monday–Sunday of the current week (local time), in start-time order, each with clock time, game, group name and Spot / max players, including lobbies that started before Monday and are still running (shown in Monday's column on desktop). The Next up lobby is also listed (DECISION, user; DECISION, product owner).
- Given that I am on a screen 760 px or wider, when I see "This week", then seven columns Monday to Sunday show a time grid with each lobby as a block in its start day's column, with the end-next-day marker from REQ-0004 (DECISION, user, 2026-11-04; F-017 applies to the group view only). Amended 2026-11-04 (Fourth amendment): the grid, its block height and the midnight rules are as in REQ-0004 (Amendment 2026-11-04 (time grid)). Old wording: "seven columns Monday to Sunday show each lobby on its start day (a lobby that started before Monday is shown on Monday), with the end-next-day marker from REQ-0004".
- Given that I am on a screen narrower than 760 px, when I see "This week", then seven Day pills Monday to Sunday are shown on top, a Day pill has a dot when its day has lobbies, and the time grid of the selected day is shown below them. Today is selected when the dashboard opens (DECISION, user; ASSUMPTION for the default day). Amended 2026-11-04 (Fourth amendment): the time grid replaces the Agenda list. Old wording: "the selected day's lobbies are listed below as the Agenda".
- Given that I select a Day pill, when the day has no lobbies, then the text "Nothing booked" is shown for that day (ASSUMPTION: wording).
- Given that I am in no group, when the dashboard opens, then there is no card and no week, and the text "You are not in a group yet" and a link to the Group list `/groups`, where the "+" creates a group, are shown (ASSUMPTION: wording; Third amendment 2026-11-04, item 1).
- Given that I am in at least one group but none of my groups has an upcoming lobby, when the dashboard opens, then Next up shows the text "Nothing booked" instead of a card, and This week shows its days with no lobbies and "Nothing booked" on each day (ASSUMPTION: wording).
- Given that a lobby has ended or been deleted, when the dashboard opens, then it is not shown (REQ-0004 rules).
- Given that any request for the dashboard fails (the group list or the lobby list of any group), when the dashboard opens, then it shows one page-level error with a retry action, and no card, week or partial set of lobbies. No toast is shown for this case (ADR 0014, point 4).
- Given that the page-level error is shown, when I press retry and the requests succeed, then the dashboard shows its normal content.
- Given that the dashboard is open, when lobbies change, then the change is shown after reloading the page (REQ-0004: no real-time updates).
- Given that I am on the dashboard, when I look for another week or a month, then there is no navigation to another week and no month view. Week navigation stays on the group calendar (REQ-0004) (ASSUMPTION).

App shell (presentation of F-001, F-002, F-004, F-005 and F-017; no new feature):
- Given that I am logged in, when I see any page, then the Top bar shows the full Wordmark "OpenLobby", never as a Group icon, and my own avatar with my display name next to it. My avatar shows my initials in the same round form as a Group icon, because the MVP has no avatar images (F-029; the auth profile has no avatar field) (DECISION, user; ASSUMPTION for the display name, REQ-0001).
- Given that I am on a phone (narrower than 760 px), when I see the app, then the Tab bar shows three items in this order: Home, Groups and You. The Tab bar respects the bottom safe area of the device, and the active tab is marked (DECISION, user, 2026-11-04; replaces the four-item Tab bar, see Second amendment 2026-11-04). There is no Calendar tab (DECISION, user).
- Given that I am on a phone and on the Group list page `/groups`, when I see the page, then a floating "+" (Create group button) is shown above the Tab bar at the bottom right, outside the Tab bar, clear of the device's safe area and not overlapping the Tab bar (DECISION, user, 2026-11-04). The "+" is shown only on `/groups` (DECISION, user, 2026-11-04; Third amendment, item 1).
- Given that I select the Groups tab, when the group list opens at `/groups`, then it shows all groups I am a member of, and selecting one opens its group view (DECISION, user; ADR 0014, point 6).
- Given that I select the You tab, when the profile opens at `/profile`, then it shows my display name and avatar, a "Log out" button, and, if I am a system admin, a "Game list" link (DECISION, user; REQ-0010).
- Given that I am not a system admin, when I open the You tab or the You page, then no "Game list" link is shown (REQ-0010, F-025; wording amended 2026-11-04).
- Given that I am on a screen 760 px or wider, when I select my avatar in the Top bar, then the You page (`/profile`) opens with the same content as the You tab (DECISION, product owner, 2026-11-04; replaces the profile menu, see Amendment 2026-11-04).
- Given that I am on a phone and open the dashboard, when I see the top of it, then the Group strip is shown: a horizontally swipeable row of my Group icons. Tapping a group opens its group view (DECISION, user).
- Given that I am on a screen 760 px or wider, when I see the app, then the Group rail is on the left: the Home control (house icon) at the top, a separator, one Group icon per group with the group name as accessible name, the active group marked, and, on the Group list page `/groups` only, the "+" (Create group button) at the bottom (DECISION, user; Third amendment, item 1).
- Given that I select Home (the house icon in the Group rail or the Home tab), when I am on any page, then the dashboard opens at `/` and that control is marked active (DECISION, user; ADR 0014, point 6).
- Given that I select a group, when its group view opens, then the view shows the group's upcoming lobbies, members and invite links in the main area, at the address /groups/{groupId}, with the navigation still visible (DECISION, user). The rules of REQ-0002 and REQ-0004 for members and non-members are unchanged.

Motion and hover (DECISION, user, 2026-11-04; see Second amendment 2026-11-04):
- Given that I point at or hover a content section or panel (e.g. Upcoming lobbies, Create lobby, Next up, This week), when the pointer is over it, then the section has no hover effect.
- Given that I point at or focus an interactive control (button, link, or a row that navigates), when the pointer is over it or it has keyboard focus, then it shows its hover or focus state.
- Given that I change page inside the logged-in app (Dashboard, Groups, a group view, a lobby page, You, Game list), when the new page opens, then the page content animates smoothly, while the Top bar, Group rail and Tab bar stay still.
- Given that reduced motion is on, when I change page, then the change is instant without animation. Given that the browser does not support the page transition, when I change page, then the change is instant.

Create group button behind "+" (presentation of F-002; behavior of REQ-0002 unchanged):
- Given that I am logged in and on `/groups`, when I press the Create group button (bottom of the Group rail, or the floating "+" on phones), then the Create group form opens from the pressed "+", its name field is focused, and the "+" turns into "×" (DECISION, user). The Create group button creates a group only, in the MVP (DECISION, user). Lobbies are created with their own button in the group view (DECISION, user).
- Given that the Create group form is open, when I press Esc, "Cancel" or "×", or tap outside the form, then the form closes and focus returns to the "+" (DECISION, user).
- Given that I enter a name of 1–50 characters and save, when the group is created, then it follows REQ-0002 and its group view opens (ASSUMPTION).
- Given that I enter an empty name or a name longer than 50 characters, when I save, then the error from REQ-0002 is shown and no group is saved.
- Given that reduced motion is on, when the form opens or closes, then the Create group form appears and disappears without animation (DECISION, user). Timing and easing belong to the design spec, not to this requirement.
- Given that I am on the Dashboard, a Group view, a lobby page, You or Game list, when I see the page, then no "+" (Create group button) is shown, neither at the bottom of the Group rail nor as a floating button on phones (DECISION, user, 2026-11-04; Third amendment, item 1).

Mobile first (cross-cutting, applies to all UI requirements):
- Given that I use a phone 390 px wide, when I use any page, then the page does not scroll sideways (except the Group strip), every tap target is at least 44 px, and input text is 16 px so the browser does not zoom (DECISION, user).

## Out of scope
- Lobbies of several groups together in a group view. Only the dashboard is cross-group.
- Month view and week navigation on the dashboard.
- Discord avatars (F-029) and game accent colors (F-030). Both are Proposed and not decided. The MVP shows initials instead (ASSUMPTION, user to overrule).
- Creating a lobby from the "+", and a Calendar tab on the phone (DECISION, user).
- Creating a lobby from a click on an empty time in "This week". The grid spans groups and the form needs one group, as with the Dashboard list (DECISION, product owner, 2026-11-04; Fourth amendment). Say out of scope; no criterion.
- Real-time updates, notifications, search, customizing the dashboard.
- A native mobile app (vision.md).
- A greeting such as "Good evening, <name>" and the date line above the dashboard heading. The name is already in the Top bar, and a time-of-day greeting needs its own rules and translations (DECISION, product owner).
- A relative heading on Next up such as "Tonight 20:00" (or "Today" / "Tomorrow"). The card shows the start date and clock time (criterion above), which needs no relative-day rules or translations (DECISION, product owner).
- The hint "You become its admin. Invite friends with a link afterwards." in the Create group form. It restates REQ-0002 and adds no behavior; the UI expert may show it as copy without a criterion (DECISION, product owner).

## Related features
F-028 (this requirement) is new: no feature shows lobbies across groups. It changes the out-of-scope line of REQ-0004 for this view only. It is not a duplicate of F-004 (list per group) or F-017 (calendar per group): the data is the same, but the scope is different, and REQ-0004 excludes cross-group views on purpose.

F-017 is unchanged for the group view: list is the default, week is the switch, no month view (DECISION, product owner). The This week section is a cross-group overview, not the calendar view. It has no view switch, so it does not create a second calendar. On desktop and on phones it is the same time grid as the group week view (DECISION, user, 2026-11-04; Fourth amendment). The list-first rule of F-017 applies to the group view only; the dashboard has no list view for This week. Old wording: "On phones the Day pills and Agenda show that week as a list, which keeps the list-first rule. On desktop it is a 7-day grid".

F-001: after login the dashboard is shown at `/` instead of the group list. Groups are reached through the Group list at `/groups`, the Group strip and the Group rail. This changes the login criterion of REQ-0001, recorded as Amendment 2026-11-04 in REQ-0001. It is not a new feature.

F-002: the create group action moves behind "+", and the "+" is shown only on `/groups` (Third amendment 2026-11-04). Presentation only; no new feature.

F-005: "Join lobby" and "Leave lobby" on the card use REQ-0005 rules; no new feature. The card's button state needs `joinedByMe` (ADR 0014, point 5), which is delivered with REQ-0005.

REQ-0010 / F-025: a system admin sees a "Game list" link in the You tab and on the You page (DECISION, user; "profile menu" amended 2026-11-04). Non-admins see no such link (REQ-0010).

## Amendment 2026-11-04
Three product owner decisions made while building the UI (PR #42), proposed by the orchestrator; the user agreed to proceed. Status stays Decided. Each item below is binding for the UI expert.

1. Avatar opens the You page on screens 760 px or wider (DECISION, product owner, 2026-11-04). The You page has the same content as the You tab: display name, avatar, "Log out" and, for system admins, "Game list". There is no separate profile dropdown menu. Reason: same content, less code; keyboard and screen-reader users get one consistent page.
   - Replaced criterion (old wording, kept for reference): "Given that I am on a screen 760 px or wider, when I select my avatar in the Top bar, then the same profile menu opens with the same content as the You tab (ASSUMPTION)."
   - Criteria amended in place: the avatar criterion in the App shell section, the "You tab or the You page" criterion, and the REQ-0010 line under Related features.
2. Log out lands on the landing page (DECISION, product owner, 2026-11-04).
   - Given that I am logged in, when I press "Log out" on the You page or the You tab, then I am logged out and the landing page at `/` is shown.
3. Lobbies link to their lobby page (DECISION, product owner, 2026-11-04). Reason: the natural next step from the dashboard; the lobby page already exists (REQ-0004).
   - Given that a lobby is shown on Next up, or in This week in the grid or the agenda, when I select it, then its lobby page at `/groups/{groupId}/lobbies/{lobbyId}` opens.

## Second amendment 2026-11-04
Three user decisions, recorded as DECISION, user, 2026-11-04. Status stays Decided. Each item below is binding for the UI expert. Item 3 replaces the four-item tab bar from the criteria above.

1. No hover effect on content sections (DECISION, user, 2026-11-04). Sections and panels such as Upcoming lobbies and Create lobby have no hover animation or hover highlight. Interactive controls (buttons, links, rows that navigate) keep their focus and hover state.
   - Criteria added in the section "Motion and hover" above.
2. Smooth page transitions inside the app (DECISION, user, 2026-11-04). Changing page inside the logged-in app (Dashboard, Groups, a group view, a lobby page, You, Game list) animates the content smoothly, so that the app feels like an application. The Top bar, Group rail and Tab bar stay still. With reduced motion the change is instant. Browsers without support change instantly. Timing and easing belong to the design spec.
   - Criteria added in the section "Motion and hover" above.
3. Phone tab bar with three items and a floating "+" (DECISION, user, 2026-11-04).
   - Replaced criterion (old wording, kept for reference): "Given that I am on a phone, when I see the app, then the Tab bar shows, in this order, Home, Groups, a large "+" (Create group button) and You (DECISION, user, 2026-11-04)."
   - Amended in place: the phone Tab bar criterion now shows Home, Groups and You. A new criterion puts the "+" as a floating button above the Tab bar at the bottom right, outside the Tab bar and clear of the safe area. The Create group criterion now names the floating "+" on phones.
   - Desktop Group rail "+" is unchanged.

## Third amendment 2026-11-04
One user decision, recorded as DECISION, user, 2026-11-04. Status stays Decided. Item 1 is binding for the UI expert.

1. The "+" (Create group) is shown only on the Group list page `/groups` (DECISION, user, 2026-11-04). On phones it is the floating "+"; on screens 760 px or wider it is the "+" at the bottom of the Group rail. It is not shown on the Dashboard, a Group view, a lobby page, You or Game list. A member creates a group from `/groups`. User's words (translated): "The button for adding a group should not be visible once you have gone into a group. It should only be visible on the main Groups page, i.e. /groups."
   - Replaced criteria (old wording, kept for reference):
     - Phone: "Given that I am on a phone, when I see the app, then a floating "+" (Create group button) is shown above the Tab bar at the bottom right, ..." (the "+" was shown on every page).
     - Group rail: "... the "+" (Create group button) at the bottom (DECISION, user)." (the "+" was shown on every page).
     - Create group: "Given that I am logged in, when I press the Create group button (bottom of the Group rail, or the floating "+" on phones), then ..." (no page condition).
     - Dashboard without a group: "... and a prompt to create a group with the "+" are shown (ASSUMPTION: wording)." (the "+" is not shown on the Dashboard).
   - Criteria amended in place: the phone "+", the Group rail "+", the Create group criterion (now on `/groups`), and the Dashboard without a group (now a link to `/groups`). One criterion added: no "+" on any other page.
   - Consequence (ASSUMPTION): a member with no group reaches the "+" through the link on the Dashboard. The UI expert sets the link text within the Dashboard's wording rule.

## Fourth amendment 2026-11-04
One user decision, recorded as DECISION, user, 2026-11-04. Status stays Decided. Binding for the UI expert. The user's words (translated): "I also want the lobby's duration shown graphically. A calendar where the days are vertical and you can see which time slots the lobby spans."

1. "This week" uses the time grid of REQ-0004 (Amendment 2026-11-04 (time grid)) on desktop and on phones (DECISION, user). The criteria amended in place above (desktop columns, phone pills with the grid) are the link to it.
   - Given that I am on a dashboard with lobbies in This week, when the grid is shown, then each block shows the lobby's game, time range, Spot / max players and group name (DECISION, user; the group name is the only addition to the group view).
   - Given that the dashboard opens, when the grid loads, then the scroll rule of REQ-0004 applies to the displayed week (desktop) or to the selected day (phone). Today's day is selected on the phone (criterion above).
   - Given that a lobby is shown in the grid, when I select its block, then its lobby page opens (criterion of the Third amendment, item 3, and REQ-0004 for the block's height and layout).
   - Given that I select an empty time in the grid, when I select it, then nothing opens, because the grid on the dashboard has no group context (DECISION, product owner, 2026-11-04; out of scope above).
2. The "This week" criterion that lists lobbies in start-time order and the rules for which lobbies appear are unchanged. The grid shows the same set of lobbies, so a lobby that started before Monday and has not ended is shown from 00:00 in Monday's column (criterion above).

## Open questions
- ASSUMPTION: Group icons are generated from the group name's initials. Presentation only.
- ASSUMPTION: Empty states use designed text, and loading uses placeholders instead of "Loading...". Exact copy is set by the UI expert. Failed loads on the dashboard use the page-level error with retry (ADR 0014, point 4), not toasts. Whether other actions use toasts is the UI expert's call.
