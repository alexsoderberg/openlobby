# REQ-0001. Log in with Discord
Status: Implemented
Feature: F-001
Priority: Must

## Problem
Members already exist on Discord and should not have to create a new account. Without login, nobody can see or change the groups' lobbies, and a shared view would be insecure.

## User story
As a member, I want to log in with my Discord account so that I get in quickly and my groups are linked to me.

## Acceptance criteria
- Given that I am not logged in, when I open the start page, then I see the "Log in with Discord" button and no group or lobby data.
- Given that I click "Log in with Discord" and approve in Discord, when I return to the app, then I am logged in and see my list of groups (empty if I am not in any).
- Given that I am logged in, when I see the header, then my Discord display name is shown.
- Given that I click "Log in with Discord" and deny in Discord, when I return to the app, then I am logged out and see an understandable error message.
- Given that I am logged in, when I click "Log out", then I am logged out and the next page view requires a new login.
- Given that I am not logged in, when I open a protected page directly via link (e.g. an invite link), then the login page is shown and after a successful login I return to the page I wanted to reach.
- Given that a user logs in for the first time, when the login succeeds, then a member account is created with the Discord display name, without any other information being needed.
- Given that I log in or use the app, when data is sent between my browser and the app, then it happens over an encrypted connection (HTTPS), so that login and group data cannot be read by third parties. The technical solution is the architect's and the operator's decision; the requirement is the behavior.

## Verification
Criteria 2, 3, 4 and 7 are verified by automated tests and the stack smoke test, not by a live Discord login. Manual step for the user: log in with your own Discord app once (approve, check the name in the header and the empty groups list, then deny once and check the error message).

## Out of scope
- Other login methods (email, password, other providers).
- Sync of Discord servers, roles or friend lists.
- Avatar images and profile editing.

## Related features
None. This is the foundation for all other features; no other feature handles login.

## Open questions
- DECISION (user): No connection to a specific Discord server. Any Discord account can log in.
- DECISION (user): The display name is updated at the next login, not in real time.
