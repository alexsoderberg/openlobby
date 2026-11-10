# REQ-0017. Live lobby updates on open screens
Status: Decided
Feature: F-035
Priority: Should

Decided by the user on 2026-11-10 (priority 2 of the new ideas, "live updates"). The user's need: the app feels too static, and members should see what is happening without reloading. This requirement changes two rules that the MVP set on purpose (REQ-0004, REQ-0012: no real-time updates); those are amended in the requirements themselves. The transport is the architect's decision.

## Problem
Today a member sees a change only after reloading the page. A member can look at a lobby, click "Join lobby" and then learn that the lobby filled up a moment ago. The group does not notice when a lobby fills up or is created, unless someone checks. The app feels like a set of static pages.

## User story
As a member, I want the lobbies and players on my screen to update by themselves when someone in my group changes them, so that I see what is happening now and do not join a lobby that has just filled up.

## Acceptance criteria

Updates in general:
- Given that I am a member and have a group view or the Dashboard open, when another member creates, joins, leaves or deletes a lobby that I can see, then my screen shows the change without a reload within 5 seconds (DECISION, user, 2026-11-10).
- Given that I am on the Dashboard, when a lobby of any of my groups changes, then Next up and This week show the change (REQ-0012).
- Given that a change arrives, when it is shown, then the changed row, block or card carries a visible marker from the moment the change arrives, until the marker ends after a duration the UI expert sets (ASSUMPTION: the duration). Given that reduced motion is on, then the marker appears and ends without animation (REQ-0012, motion rule).
- Given that nothing has changed, when I look at the screen, then it does not refresh visibly: no flicker, no re-animation, no scroll change.
- Given that several changes arrive, when they are shown, then each lobby appears once, in its current state.
- Given that I am editing a form (Create lobby, Create group) or have the list, calendar or Day list open, when a change arrives, then my entered text, the open form, my scroll position and my chosen view or day stay as they are.
- Given that a change is shown and the lobby ends or moves out of the current week, when it arrives, then the screen shows the same data a reload would show (REQ-0004, REQ-0012 rules).

Specific changes:
- Given that I am on the lobby page and another member joins or leaves, when the change arrives, then the player list and the player count (X/Y players) are updated.
- Given that I am on the lobby page, when the lobby becomes full, then the "Join lobby" control shows that there is no free spot without my clicking it first. A click that is still made is denied as in REQ-0005.
- Given that I am on any screen that shows a lobby, when its creator deletes it, then the lobby disappears from the list, the week view, the Day list, Next up and This week without an error dialog (REQ-0005).
- Given that I am on the lobby page and the creator deletes the lobby, when the change arrives, then the page shows "The lobby no longer exists" (REQ-0005), with no error dialog.

Connection:
- Given that the connection for live updates is lost, when the screen is still open, then the screen shows a visible text notice on the page that live updates are paused, until updates resume (ASSUMPTION: the wording and place are the UI expert's). It shows its last data and no error page.
- Given that the connection is restored, when the notice is shown, then the screen loads the current data and the notice disappears.
- Given that the page is hidden (background tab, app in the background), when no update is received, then no update is run and no connection is kept for it (DECISION, user, 2026-11-10: updates only while the page is visible, no background updates).
- Given that I return to a browser tab or app that was hidden, when it is visible again, then the screen loads the current data and catches up with every change made meanwhile (DECISION, user, 2026-11-10).
- Given that I leave a group, when I am no longer a member, then I receive no updates of that group, and its lobbies are no longer shown to me (REQ-0006).
- Given that I am not a member of a group, when I try to receive its updates, then nothing is sent (REQ-0004: the 404 page, no lobby information).

## Out of scope
- Notifications outside the app: push messages, sound, browser notifications, a counter in the browser tab title, and Discord messages (F-015, F-016).
- Live updates for membership changes: someone joins or leaves the group, the member list, the Group rail and the invite popover (REQ-0002, REQ-0006, REQ-0007).
- Live updates for the game list and for game, mode or activity changes made by a system admin (REQ-0010, REQ-0015). A lobby changed by a player (REQ-0015) does update, as any lobby change.
- Presence (who is online), typing indicators, live chat or comments.
- Group feed events (REQ-0018). The feed uses this requirement for its new entries, but its content is defined there.
- Locking or conflict handling of concurrent edits: REQ-0003 and REQ-0015 keep their rules.

## Related features
F-004, F-017, F-028, F-005 and F-003 show the same lobbies; this requirement changes when they are refreshed, not what they show. F-015 (notifications) is about messages that reach the user outside the app; this is in-app only, so F-015 stays Proposed for push notifications. It is not a duplicate: no feature updates screens without a reload, and REQ-0004 and REQ-0012 explicitly excluded it, which is why they are amended (Amendment 2026-11-10 in each). REQ-0018 (Group feed) shows its new entries through this requirement.

## Open questions
- DECISION (user, 2026-11-10): the latency target is 5 seconds.
- DECISION (user, 2026-11-10): updates run only while the page is visible. A hidden tab catches up when it becomes visible again. No background updates.
- OPEN QUESTION: the wording and place of the paused notice, and the duration of the change marker, are the UI expert's (ASSUMPTION).
- For the architect: the transport is a new communication pattern between the gateway and the browser and needs an ADR. Each open page adds a connection, and the Dashboard follows all of the member's groups; the connection and load budget of the Raspberry Pi 5 (ADR 0008) must hold. Which service publishes the change is the architect's decision.
