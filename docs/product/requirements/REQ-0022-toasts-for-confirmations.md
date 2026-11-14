# REQ-0022. Toasts for confirmations
Status: Decided
Feature: F-041
Priority: Should

DECISION, user, 2026-11-12: use toasts for the success confirmations listed below. They are built with sonner behind a house component (ADR 0023, point 4). This reverses the dark spec decision of 2026-11-03 (`docs/superpowers/specs/2026-11-03-dark-luxury-ui-design.md`), which kept copy feedback and the invite link confirmations inline. The user made this reversal on 2026-11-12. The spec file is not edited here.

DECISION, user, 2026-11-13: toasts are shown in the bottom-right corner and fade out after a few seconds. Added before any code. The position and the fade-out are the criteria marked "(DECISION, user, 2026-11-13)" below.

DECISION, user, 2026-11-13 (second answer): the toast lasts 4 seconds and pauses while the pointer is over it or keyboard focus is inside the toast region. On phones the toast sits bottom right, above the floating "+" button, and never covers the tab bar. The toasts are built as part of the shadcn rollout (ADR 0023), right after ADR 0022 PR5 and before A4 (backlog A3a). The margin of 16 px and the other values marked ASSUMPTION are not decided by the user.

DECISION, user, 2026-11-13 (build order): in the shadcn rollout, Dialog is built before toasts (order Button → Dialog → Toasts → Tooltip → Menu → Popover), so a toast is never hidden under a dialog. The criterion on a toast shown while a dialog is open depends on this order.

## Problem
A member who has just acted sometimes gets the confirmation at a place they are not looking at. When the Create lobby form closes, the "Lobby created" text sits in the lobby panel above the list, while the form was the thing they looked at. A copied invite link is confirmed in a line below the list of links. The confirmation text stays on the page until the next change, so the page carries old text.

## User story
As a member, I want a short confirmation of a successful action that appears where I can see it and then goes away, so that I know the action worked without reading a text that stays on the page.

## Terms
- **Toast**: the short text that confirms a success and then disappears (ADR 0023). A toast is a confirmation only. It is never a question, an error or a status of a live change.
- **Toast region**: the place on the screen where toasts are shown. It is the bottom-right corner (see the criteria below).
- The texts are the existing texts of `frontend/src/i18n/messages/en.ts`, unless a criterion gives a new one. The UI expert may shorten a text to one sentence, but keeps its facts and its plain wording.

## Acceptance criteria

Where toasts are shown (the nine places in the table at the end of this section):
- Given that one of the nine actions succeeds, when its result is saved, then one toast shows the confirmation text of that action, and the same text is not shown inline on the page (ADR 0023, point 4: never twice).
- Given that a toast is shown, when a screen reader is used, then the text is announced once, politely, without interrupting what the user is reading (DECISION, user, 2026-11-12).
- Given that a toast is shown, when I look at it, then it has no button, no link and no undo (ADR 0023, point 4).
- Given that a toast is shown, when it appears, then the focus stays on the element that had it, and the toast does not take focus.
- Given that a toast is shown while another toast is shown, when the second one comes, then the first one is replaced, so that only one toast is shown at a time (ASSUMPTION).
- Given that a toast is shown while a popover or a dialog is open (for example the invite popover or the Create lobby form), when it appears, then it is visible above that popover or dialog.
- Given that a toast is shown, when the page changes, then the toast stays for its duration, because it confirms an action that has just happened (ASSUMPTION).
- Given that reduced motion is on, when a toast appears or disappears, then it shows in its final state with no motion (the motion rules of ADR 0023, points 2 and 4).

Position (DECISION, user, 2026-11-13):
- Given that I use a window of 760 px or wider, when a toast is shown, then it is in the bottom-right corner of the window, with its right and bottom edges inside the window by a margin of 16 px (ASSUMPTION: the margin; the corner is the decision).
- Given that I use a phone (under 760 px), when a toast is shown on a screen with the floating "+" button, then the toast sits in the bottom right, above the "+" button, and does not cover the "+" button or the tab bar (DECISION, user, 2026-11-13; REQ-0012, mobile rule).
- Given that I use a phone (under 760 px), when a toast is shown on a screen without the floating "+" button, then the toast sits in the bottom right, above the tab bar, and does not cover the tab bar (ASSUMPTION: the same corner, where no "+" button is shown).
- Given that I use a phone, when a toast is shown, then it is not hidden behind the bottom navigation and does not cover the main action of the screen (REQ-0012, mobile rule).

Fade-out (DECISION, user, 2026-11-13: after a few seconds):
- Given that a toast is shown and no pointer is over it and no keyboard focus is inside the toast region, when 4 seconds have passed, then it fades out and is removed from the page, and leaves nothing on the page (DECISION, user, 2026-11-13: 4 seconds; the fade-out is the decision).
- Given that the pointer is over a toast, when the timer would end, then the timer pauses, and it continues after the pointer leaves (DECISION, user, 2026-11-13).
- Given that keyboard focus is inside the toast region, when the timer would end, then the timer pauses, and it continues after focus leaves the region (DECISION, user, 2026-11-13).
- Given that a toast is shown, when I read its text, then its text meets WCAG AA contrast against its background, as all text in the app does (dark spec 2026-11-03, accessibility rule).

Lobby created (the one conditional case):
- Given that I create a lobby and the form closes, when the lobby list has loaded again and the new lobby is in the list or week view shown on the page, then no toast is shown and no inline text is shown either.
- Given that I create a lobby and the form closes, when the lobby list has loaded again and the new lobby is not in the week view shown on the page, then the toast "Lobby created. You are the first player." is shown.
- Given that I create a lobby and the form closes while the list is still loading, when the list has loaded, then the rule above decides, and no toast is shown from a list that has not loaded again.

Copy feedback:
- Given that I copy an invite link and the copy works, when the copy is done, then the toast "Link copied." is shown.
- Given that I copy an invite link and the copy fails, when it fails, then the text "The link could not be copied. Select the link and copy it by hand." is shown where it is shown today, and no toast is shown (errors are never toasts).

Errors and failed loads:
- Given that any action fails or is refused (validation, a denied change, a request that does not reach the server), when the failure is shown, then it is shown where it is shown today and not as a toast.
- Given that a load fails, when the page shows the failure, then it is the page-level error with retry (ADR 0014, point 4), and no toast is shown.

Live updates and other members:
- Given that another member creates, joins, leaves, changes or deletes a lobby, when my screen updates (REQ-0017), then no toast is shown for it. Toasts confirm only my own actions.
- Given that live updates are paused, when the paused notice is shown, then it stays inline and is not a toast (REQ-0017, ADR 0019).

Nothing else changes:
- Given that an action has no confirmation today (for example joining or leaving a lobby, or logging out), when it succeeds, then no toast is added. This requirement changes the way existing confirmations are shown and adds none.

### The nine places that switch to a toast

These replace the inline success status of the place, which is removed. Each is an existing confirmation (`role="status"` or a status line in the code today).

| # | Place | Code today | Text key today | Toast |
|---|---|---|---|---|
| 1 | Invite popover, after a link is created | `features/invites/InviteLinks.tsx` | `inviteLinkCreated` | the same text |
| 2 | Invite popover, after a link is revoked | `features/invites/InviteLinks.tsx` | `inviteLinkRevoked` | the same text |
| 3 | Invite popover, after a link is copied | `features/invites/InviteLinks.tsx` | `inviteLinkCopied` | "Link copied." |
| 4 | Create group form, after the group is created | `features/groups/CreateGroupForm.tsx` | `groupCreated` | the same text |
| 5 | Group list, after leaving a group | `app/LoggedInApp.tsx` | `groupLeft` | the same text, with the group name |
| 6 | Game list (system admin), after a game is added, changed or removed | `features/games/GamesPage.tsx` | `gameAdded`, `gameChanged`, `gameRemoved` | the same texts |
| 7 | Group view, after a lobby is created, only when the lobby is not visible (criteria above) | `features/lobbies/Lobbies.tsx` | `lobbyCreated` | "Lobby created. You are the first player." |
| 8 | Lobby page, mode or activity saved | `features/lobbies/LobbySettings.tsx` (`Result`) | `lobbySettingsSaved` | "Saved." |
| 9 | Lobby page, game set | `features/lobbies/LobbySettings.tsx` (`Result`) | `lobbyGameSaved` | "Game set." |

Place 7 has no inline status after this change, in either case: the lobby is shown in the list or the week view, or the toast is shown.

Places 8 and 9 today move focus to the result text, because the game control leaves the page when the lobby loads again. With a toast there is no result text to focus, so the criterion is: given that I save the game, mode or activity, when the save is done, then focus is not lost to the page body. The focus stays on the control I used, or moves to a control in the same section. The UI expert chooses which.

### Stays inline (not a success confirmation, or an error)

- Copy failure (`inviteLinkCopyFailed`, the failure of place 3): an error. Stays inline, as above.
- Failed invite link changes, failed group creation, failed game changes, refused lobby settings: errors shown as today.
- Loading texts shown with `role="status"`, for example `groupLoading`, `groupsLoading`, `dashboard.loading`, `gamesLoading`, `lobbiesLoading`, `lobbyLoading`, `sessionLoading`, `inviteLoading`, `inviteLinksLoading`, `gameListLoading`: they report progress, not a success.
- "Joining the group." (`joinGroupBusy`): progress.
- "Ended" on a lobby (`lobbyEnded`): a state of the lobby, not a confirmation.
- Notices of the logged-out page (login errors, "Your session has ended", `features/session/loggedOut.ts`): errors and session state, shown on the page as today.
- The paused notice of live updates (REQ-0017).
- The totals that are announced with `aria-live` (`LobbyRoleFields`, `LobbyCalendar`): values of the form, not confirmations.

## Out of scope
- A button, a link or an undo in a toast (ADR 0023, point 4). An undo needs its own requirement and its own timing decision.
- Toasts for errors, validation, failed loads, or live updates from other members (see above).
- A list of earlier toasts, a notification centre or a history of confirmations.
- Notifications outside the app (F-015, F-016): a toast is seen only while the app is open.
- New confirmations for actions that have none today.
- Sound, vibration, or a toast that asks for an answer.
- Other positions than the bottom-right corner, and a user setting for the position or the duration. Only the decided position and fade-out are built.
- The look of a toast beyond the design tokens (colour and radius from `global.css`, ADR 0023, point 3). The UI expert chooses it within those rules.

## Related features
- F-002 (create group, create invite link, copy invite link), F-013 (revoke invite link), F-010 (leave group), F-025 (game list), F-003 (create lobby), F-033 and F-034 (mode, activity and game of a lobby). Each of these features keeps its behavior. Only how its success is confirmed changes. They are not duplicates of this feature, and this feature is not a duplicate of them.
- Not a duplicate of any feature: no feature shows success confirmations as toasts. F-041 is registered because it is a decided, testable behavior that applies to several features at once. Its nine places are the inline statuses of those features.
- F-015 (notifications about new lobbies or player status changes): toasts confirm my own actions in the app. They never report other members' changes, and they are not sent outside the app. F-015 stays Proposed.
- F-035 (live lobby updates, REQ-0017): the live update notice stays inline. Live updates produce no toast.
- ADR 0023 (header): toasts need a decided requirement before any code. This is that requirement.

## Open questions
1. ASSUMPTION for the user to confirm: "visible" in the lobby created rule means "in the list or the week view shown on the page". In list view the new lobby is always in the list, so the toast for a lobby created in list view never shows. It can show only in week view, when the lobby is in another week. Does the user want the confirmation also in list view, for example by a different rule? Recommended answer: keep the rule as written and check it after use.
2. Answered (DECISION, user, 2026-11-13): 4 seconds, pause on hover and keyboard focus, and the phone position above the "+" button and never over the tab bar. Still ASSUMPTION: the 16 px margin from the window edges, and the phone position on screens without the "+" button. Recommended answer: keep both and check them after use.
3. ASSUMPTION: only one toast at a time, and a toast stays for its duration when the page changes. Recommended answer: keep both.
4. Focus target after "Game set." and "Saved." is the UI expert's choice within the focus criterion above.
5. The copy failure text stays inline as today. Whether an inline error is announced as an alert is not part of this requirement and is for the UI expert and the architect.
