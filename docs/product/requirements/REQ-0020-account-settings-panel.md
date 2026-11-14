# REQ-0020. Account settings panel on the You page
Status: Implemented
Feature: F-038
Priority: Should

Decided by the user on 2026-11-12. Frontend only. This requirement sets the structure of the page; it adds no new setting.

## Problem
The You page is one panel with the display name, the avatar, a plain text "Game list" link for system admins, and Log out. The Game list link looks like an ordinary line of text, so a system admin does not see it as a way to another page. The page has no structure for account settings, so each later setting would mean rearranging the page.

## User story
As a member I want the You page to be an account settings panel with clear sections, so that I find my account, the system admin area and Log out at once, and later settings have a clear place.

## Acceptance criteria

Sections and order:
- Given that I am logged in, when I open the You page or the You tab, then the page shows the section "Account" and, only if I am a system admin, the section "System admin", followed by the "Log out" button. "Log out" is the last item on the page.
- Given that I am logged in, when I see a section, then its title is a heading, so that a screen reader user can move from section to section by heading.
- Given that I am not a system admin, when I open the You page, then no "System admin" section is shown and no "Game list" row is shown.
- Given that I am a system admin, when I open the You page, then the "System admin" section shows one row, "Game list", and selecting it opens the Game list (REQ-0010).

Account section:
- Given that I open the You page, when I see the "Account" section, then it shows my avatar (REQ-0016, or my initials when I have no picture) and my display name, as today.
- Given that I open the You page, when I see the "Account" section, then the text "Signed in as" is shown as a small label above my display name. The label is smaller than the eyebrow size used elsewhere in the app, 0.75rem: on the You page it is 0.6875rem (DECISION, user, 2026-11-12).
- Given that I open the You page, when I look at the "Account" section, then there is no control to change my display name or my avatar (profile editing is out of scope, REQ-0001).

Game list row:
- Given that I am a system admin, when I see the "Game list" row, then it is a full-width row with an icon at its start, the text "Game list" and a chevron at its end, and the whole row is the link.
- Given that I am a system admin and I use a phone, when I see the "Game list" row, then the row is at least 44 px high.
- Given that I am a system admin, when I use the keyboard, then I reach the "Game list" row with Tab, open it with Enter, and see a visible focus state. Its accessible name is "Game list"; the icon and the chevron are not read out.

Log out (unchanged behavior):
- Given that I am logged in, when I press "Log out", then I am logged out and the landing page is shown (REQ-0012, REQ-0001).
- Given that logging out fails, when the error is shown, then the error is shown next to the "Log out" button and I can retry, as today.

Layout and later sections:
- Given that I open the You page on a phone or on a screen 760 px or wider, when I see it, then the sections and their order are the same on both (REQ-0012: same content).
- Given that a later requirement adds a settings section, when the page is shown, then the new section sits above "Log out", the sections before it keep their order, and "Log out" stays the last item.

## Out of scope
- Any new setting: language (F-026), theme, notifications, privacy, or game roles (REQ-0021 is a separate draft).
- Changing the display name or the avatar (REQ-0001, REQ-0016).
- Group settings, leaving a group or any other group action. Leaving stays in the group view (REQ-0006).
- Managing system admins (REQ-0010).
- Deleting the account.
- A profile dropdown menu in the Top bar. REQ-0012 has no such menu.
- Changes to the Game list page itself (REQ-0010).

## Related features
- F-001 (Log in with Discord): the You page shows the logged-in identity and Log out. It is a presentation of F-001 and needs no feature of its own.
- F-025 (Manage game list as system admin): the "Game list" row is the existing entry point to F-025, moved into the "System admin" section. It is not a new entry point.
- F-029 (Discord avatars): the "Account" section shows the avatar taken from F-029. Not a new feature.
- F-038 (this feature) amends the You page criteria of REQ-0012 (content and the Game list link). The other REQ-0012 criteria stay as they are: the Tab bar, the avatar in the Top bar opening the You page, and Log out landing on `/`.
- No feature in `features.md` is an account settings page, so this is not a duplicate. Later settings are new features that add a section to this page.

## Decisions
- DECISION (user, 2026-11-12): the You page becomes an account settings panel. Structure only, no new setting in this requirement. Sections: Account, System admin (system admin only), Log out.
- DECISION (user, 2026-11-12): section title "System admin", not "Admin". The glossary says "Admin" without a prefix is to be avoided, because it can mean group admin or system admin.
- DECISION (user, 2026-11-12): the "Signed in as" label stays on the You page, in a smaller size than before.
- ASSUMPTION (priority and order): Should, placed after the group feed (A6) as A8 in `backlog.md`. The user may move it earlier; it is small.

## Open questions
None open. The section title "System admin" and the "Signed in as" label are decided by the user (2026-11-12).
