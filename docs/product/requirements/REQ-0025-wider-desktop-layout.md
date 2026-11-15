# REQ-0025. Wider desktop layout on the main pages
Status: Decided
Feature: F-044 (new). Extends F-017, F-028, F-036 (placement), F-043, F-003 and F-005 (lobby page layout, presentation only). Amends the width rules of REQ-0019 and REQ-0012 and the group view rules of REQ-0019.
Priority: Should
Build (2026-11-15): built, except the Group list card grid (waits for REQ-0024 Group cards) and the Group feed in the Group view side column (not built, waits for F-036 Group feed).

Decided by the user on 2026-11-14 (DECISION, user, 2026-11-14):
- the main area is wider on desktop, with the extra width used on the Dashboard, the lobby page, the Group list and the Group view, not only stretched;
- phones and narrow windows keep the one-column layout;
- the app's max width is about 100rem (the answer to "how wide may the app get"), and the side column starts at a window width of about 98rem (about 1570 px), one breakpoint for all pages and both views of the group view;
- the Group view side column holds the members and the Group feed only, invite links stay in the Invite popover;
- the side column is on the right;
- the lobby page shows players and settings side by side;
- the Group feed sits below the members in the Group view side column.

Decided by the product owner on 2026-11-14 (DECISION, product owner, 2026-11-14): the width cap and the text measure apply to every logged-in page, not only to the four pages above (see Width below). The product owner set the priority (Should): it changes how existing pages are laid out, and no other requirement depends on it. Items marked ASSUMPTION are not decided by the user; the UI expert settles them within the criteria.

## Problem
On desktop the app is narrow. Today the main area box is 72rem wide (about 1150 px, including its padding) and centred, so on a wide window the pages leave large empty margins. Only the week grid of REQ-0019 takes that width. The Dashboard, the lobby page, the Group list and the Group view each show one column of content.

## User story
As a member on a desktop, I want the pages to use a wider main area with the important content and the secondary content side by side, so that I see more of a group, a lobby or the week on one screen without scrolling.

## Terms
- **Main area**: the page area of the app shell, beside the Group rail (as today).
- **Main area box**: the main area including its padding. Its maximum width is 100rem. Today's box is 72rem, with 6rem padding, so today's grid content is 66rem.
- **Main column**: the part of a page with its primary content (the week grid, the lobbies, the players, the cards).
- **Side column**: the column beside the main column, on the right, 19rem wide with a 1rem gap (ASSUMPTION: the width is the UI expert's within this figure). It holds secondary content only: Next up (Dashboard), the members and the Group feed (Group view), the settings (lobby page).
- **Side column breakpoint**: a window width of 98rem (about 1570 px) (DECISION, user, 2026-11-14). Below it no side column is shown.

## Acceptance criteria

Width (every logged-in page, screen 760 px or wider):
- Given that I am on a screen 760 px or wider, when I see any logged-in page, then the main area box is centred, with side margins on both sides, and it is at most 100rem wide including its padding (DECISION, product owner, 2026-11-14; the margin size is ASSUMPTION for the UI expert).
- Given that the window is between about 77.25rem (about 1236 px, where today's 72rem box stops growing) and about 105.25rem, when I see a page, then the box grows with the window. The pages are wider than today in this range. This is the intended change, not a defect (DECISION, product owner, 2026-11-14; it was not stated in the user's request). ASSUMPTION for these figures: the Group rail is 5.25rem wide as today, and a 0.5rem scrollbar is not counted.
- Given that the window is wider than about 105.25rem, when I see a page, then the box is 100rem wide and does not grow further.
- Given that a paragraph, a form, an empty-state text or another text block is shown on any logged-in page, when the window grows, then its width stays at most 48rem, starts at the left edge of the main column, and does not grow with the box (ASSUMPTION: the 48rem measure is the UI expert's value within a readable line length; DECISION, product owner, 2026-11-14: every page, so the You page and the Game list get no long lines). List rows (the rows of the You page, Game list and Group list, with names, counts and buttons) are not text blocks and may use the full width of the box (DECISION, product owner, 2026-11-15: they hold short text, so no long lines of reading text arise).
- Given that I am on a phone (narrower than 760 px), when I see any page, then its layout is as today. This requirement changes nothing on phones (REQ-0012 and REQ-0019 phone rules).
- Given that I resize the window across the 760 px line or the 98rem line, when the layout changes, then the page shows the layout of the new width without a reload.

Week grid width (the grid of REQ-0019, on the Dashboard and in the group view):
- Given that the window is narrower than 98rem (and 760 px or wider), when I see a week grid, then the grid is the full width of the main area box, minus the padding: the window width minus about 11.25rem, so at most about 86.75rem just below 98rem. There is no side column (ASSUMPTION for the 5.25rem rail and the 6rem padding).
- Given that the window is 98rem or wider, when I see a week grid with its side column, then the grid is the main column, which is the box minus the padding minus the 19rem side column and its 1rem gap. The grid is about 66.75rem at 98rem (ASSUMPTION: with a 0.5rem scrollbar about 66.25rem, still not narrower than today's 66rem), and about 74rem from about 105.25rem window width and wider.
- Given that the window is 98rem or wider, when I compare the grid with today's, then the grid is never narrower than today's 66rem (DECISION, user, 2026-11-14: the week grid is never narrower than today).
- Given that the window crosses 98rem, when the side column appears, then the grid becomes narrower than it was just below 98rem (about 86.75rem to about 66.75rem). This is the effect of the side column. DECISION (product owner, 2026-11-14): accepted as a consequence of the user's 98rem breakpoint and the rule that the grid is never narrower than today (DECISION, user, 2026-11-14); the user has not separately confirmed this drop.

Side column breakpoint (Dashboard, lobby page and Group view; screen 98rem or wider; DECISION, user, 2026-11-14):
- Given that the window is narrower than 98rem (and 760 px or wider), when I see the Dashboard, a lobby page or a group view, then the page has one column and no side column, as today. The members of a group view sit below its lobbies in both views (this changes today's List view from 75rem, DECISION, user, 2026-11-14).
- Given that the window is 98rem or wider, when I see the page, then the side column is shown on the right as in the criteria below.
- Given that the page has no side content, when I see it, then no empty side column is shown (see the Dashboard criteria below).
- Given that the Group list is shown, when the window is narrower or wider than 98rem, then this breakpoint does not apply to it; its cards are laid out by its own rule below.

Dashboard (`/`, screen 98rem or wider):
- Given that I am on the Dashboard with lobbies, when I see it, then Next up is in a side column on the right, and This week is in the main column (DECISION, user, 2026-11-14: Next up beside This week, on the right).
- Given that I am in at least one group and none of my groups has an upcoming lobby, when I see the Dashboard, then the side column on the right shows Next up with its empty text "Nothing booked" as in REQ-0012, and This week is in the main column with its empty days (ASSUMPTION: the side column keeps its place when Next up is empty, so the layout does not change when a lobby is booked; the text is REQ-0012's).
- Given that Next up is in the side column, when I see it, then its content, countdown, buttons and rules are as in REQ-0012 and REQ-0005. Only its place changes.
- Given that This week is in the main column and the Week calendar is selected, when I see it, then the time grid fills the main column, and its height and opening scroll are as in REQ-0019 (grid widths in the criteria above).
- Given that This week is in the main column and the Day list is selected, when I see it, then the Day list fills the main column, and its rules are as in REQ-0012 (Amendment 2026-11-07).
- Given that I am in no group, when I see the Dashboard, then no side column is shown, and the text "You are not in a group yet" is in the main column.

Group view (`/groups/{groupId}`, screen 98rem or wider):
- Given that I open a group view with the Calendar view shown, when I see the page, then the week grid is in the main column, and the side column on the right holds the members panel with the Group feed below it (DECISION, user, 2026-11-14; this amends REQ-0019, see its Amendment 2026-11-14).
- Given that I open a group view with the List view shown, when I see the page, then the lobbies are in the main column, and the side column on the right holds the members panel with the Group feed below it (DECISION, user, 2026-11-14: one breakpoint for both views).
- Given that the group view is shown in a side column layout, when I look at the page heading (group name and Invite button), then it stays above the main column and the side column. The Create lobby button and the view switch stay at the top of the main column, inside the lobbies panel, as today (DECISION, product owner, 2026-11-15; Old wording: "when I look at the header (group name, Create lobby button, Invite button) and the view switch, then they keep their place and content above the main column and the side column.").
- Given that the group view is shown in a side column layout, when I press the Invite button in the header, then the invite popover opens as in REQ-0002 (Fourth amendment in REQ-0012). The side column holds no invite links (DECISION, user, 2026-11-14).
- Given that the Group feed is in the side column, when I look at it, then it shows the same events, rules and empty text as in REQ-0018, and it is not shown in the main column (DECISION, user, 2026-11-14).

Lobby page (screen 98rem or wider):
- Given that I open a lobby page, when I see it, then the players are in the main column and the lobby settings are in the side column, side by side (DECISION, user, 2026-11-14). Which panel holds which content is ASSUMPTION for the UI expert. The content and buttons of REQ-0005, REQ-0015 and REQ-0011 are unchanged.

Group list (`/groups`):
- Given that I am on a screen 760 px or wider, when `/groups` shows its cards, then the cards form a grid of two or more columns in the main area, each card a Group card as in REQ-0024 (DECISION, user, 2026-11-14: a multi-column grid). The number of columns and the card width are ASSUMPTION for the UI expert, within the main area box. The 760 px line is ASSUMPTION for the UI expert (the card grid's own breakpoint, not the side column breakpoint).
- Given that the card grid is shown, when I look at the cards, then they are in the order that REQ-0024 sets (its sorting rule applies), and they fill the rows from the left (ASSUMPTION: the row filling).
- Given that the card grid is shown, when I look at a card, then the card content, the link and the empty, loading and error states of REQ-0024 are unchanged.
- Given that I am on a phone (narrower than 760 px), when `/groups` shows its cards, then they form one column, as REQ-0024 says.

Order and accessibility:
- Given that I move through a page with the keyboard, when I go from one part to the next, then the focus order is the order of the one-column layout (ASSUMPTION: the page's source order): the Dashboard's Next up comes before This week, and the group view's lobbies come before its members and the Group feed.
- Given that a screen reader reads a page in a side column layout, when it reads the page, then the reading order is the same as in the one-column layout (ASSUMPTION: the same source order as above).
- Given that I use a side column layout, when I look at a side column, then no content in it is hidden or cut off by the main column.

## Out of scope
- Any change on phones and on screens narrower than 760 px. Below 98rem the Dashboard, lobby page and group view have one column, as today, apart from the List view members rule above.
- A change of the content, rules or buttons of any panel: Next up, This week, the week grid, the lobbies, the members, the Group feed, the lobby players and settings, the Group list cards. Only their place and width change.
- Invite links in the side column (DECISION, user, 2026-11-14).
- Side columns on the You page and the Game list. They get the wider box and the text measure only. The landing page is logged out, outside the app shell, and is unchanged.
- A user setting for the width or for the layout (no choice of layout by the user).
- A sticky or independently scrolling side column (ASSUMPTION: the page scrolls as a whole, as today).
- The create forms when they are shown in a dialog.
- Live updates, the Top bar, the Group rail and the Tab bar.

## Related features
- F-017 (week view of the group view): the grid is wider with the box, and from 98rem the members panel is a side column beside it in both views. Amends REQ-0019 (Amendment 2026-11-14). Extends F-017; not a new feature.
- F-028 (Dashboard, Next up and This week): the box width and the place of Next up from 98rem. Amends REQ-0012 (Amendment 2026-11-14). Extends F-028; not a new feature.
- F-036 (group feed, REQ-0018): its place in the group view is the side column below the members, from 98rem (DECISION, user, 2026-11-14). The feed's content and rules are unchanged.
- F-043 (group cards on the group list): the cards are laid out in a grid on screens 760 px or wider. REQ-0024 is not amended: its phone rule stays, and the desktop grid is set here. Extends F-043; not a new feature.
- F-003 and F-005 (the lobby page): the page shows players and settings side by side from 98rem. The content and rules of those features are unchanged.
- F-044 (new, this requirement): no feature sets the page width or the column layout of the logged-in pages. The app shell presentation has no feature of its own (F-028 comment), but this changes bounds decided in REQ-0019 and REQ-0012, and it touches four pages and the text measure of all, so it is tracked on its own. The product owner judges it NEW, not a duplicate: it adds no data and no action, and it changes only size and place.

## Open questions
None. The open questions of the draft are decided by the user (DECISION, user, 2026-11-14): the side column is on the right, the side column breakpoint is 98rem, the Group view side column holds the members and the Group feed, invite links stay in the popover. The glossary terms "Main area", "Main column" and "Side column" are requested in the glossary (CLAUDE.md, architect).

Items still ASSUMPTION for the UI expert: the margin size, the 5.25rem Group rail width and the 0.5rem scrollbar used in the arithmetic, the side column width, the card column count and card width of the Group list, the 760 px line of the card grid, the 48rem text measure, the empty Next up layout on the Dashboard, and the focus and reading order.
