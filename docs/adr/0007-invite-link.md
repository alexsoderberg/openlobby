# 0007. Invite links
Status: Accepted (2026-11-01)

Revised after the user's decision (third round): each link has a max number of uses, mandatory, 1–10, with default 10 when the creator does not choose. The limit exists to counter bot abuse. The second round still applies unchanged: uses are counted at join, and admins see, copy and revoke all active links in the group, including tokens. Earlier decisions still apply unchanged: several active links per group, links are created only on request, revocation by the link's creator or the group's admin, members see only their own links, and expiry after 2 hours. A revoked, expired, exhausted or unknown link (links of members who left are deleted) gives the same response (`404 invite_invalid`).

## Context
Groups are private and are reached only through an invite link (vision.md, REQ-0002). The link is therefore the only access control for joining a group. It must be impossible to guess, not logged in plain text, and possible to show again to members. Members create links when needed. A leaked or old link must stop working without the group being affected. The user wants links to behave like Discord's: you limit how many people join via a link, and all links have such a limit.

## Decision

**Format:** 32 random bytes from `crypto/rand`, base64url-encoded (43 characters, about 256 bits of entropy). The link is `/invite/{token}` in the frontend and `/api/invites/{token}` in the API.

**Storage:** the table `invite_links` (see ADR 0006). The token is stored in plain text. Members see their own links and admins see all group links, and both must be able to copy them (REQ-0002). A hash would make listing and copying impossible. Admins therefore can read other members' tokens. This gives no access that an admin does not already have: an admin is a member and can create their own links with the same effect. The token is used for nothing other than joining that specific group. The risk is limited by the database role access and by the fact that the token is never logged. Responses containing a token get `Cache-Control: no-store`.

**Validity:** `expires_at = created_at + 2 hours`. The time is set when the link is created and stored in the row. The duration is a named domain constant in calendar (`InviteLinkLifetime`), not an environment variable, because no requirement says it should change per environment. Storing the expiry time, instead of computing it from `created_at` on each read, gives two benefits: the check becomes a comparison in SQL, and a future change of the constant does not affect links that already exist.

**Uses:**
- `max_uses`: integer 1–10. Mandatory: each link has a max. The creator chooses the value at creation. A missing field or `null` gives the default 10. A value outside 1–10, or wrong type, gives `invalid_max_uses`. Set at creation and not changed.
- The rule is two named domain constants in calendar: `InviteLinkMaxUsesLimit = 10` (highest allowed value) and `InviteLinkDefaultMaxUses = InviteLinkMaxUsesLimit` (default). Validation and default are done in one place, a domain function `NewInviteLinkMaxUses(requested *int) (InviteLinkMaxUses, error)`. The application calls it, and the transport only decodes the value.
- The database check (ADR 0006) mirrors the limit 1–10 as a safety net. The literal in the migration must change in the same step as the constant, with a new migration.
- `use_count`: the number of successful joins via the link. Starts at 0 and is always shown together with `max_uses`.
- A join is a new membership via join. An existing member who uses the link again changes nothing and is not counted. A new join after the member has left the group is counted, because it is a new membership.

**Active link:** a link is active when `expires_at > now` and `use_count < max_uses`, where `now` comes from the port `Clock`. The rule lives in one place: the domain method `InviteLink.IsActive(now)`. The repository only stores, and the application uses the method when displaying, when joining and when listing.

**Check and count at join (atomic):**
1. Find the link via token without a lock to get the group. Unknown token → `invite_invalid`.
2. Lock the group (`SELECT ... FOR UPDATE`, ADR 0006).
3. Read the link again. If it is missing or not active → `invite_invalid`.
4. If the caller is already a member: respond as for a new join, but change nothing.
5. Otherwise: create the membership and increment `use_count` in the same transaction.

The group lock is the only serialization point. Two concurrent joins on the last use: the second sees `use_count = max_uses` after the lock and gets `invite_invalid`. No separate row lock on the link. The order in step 3 before step 4 means that an exhausted or expired link denies even an existing member, just like a revoked link.

**Cleanup:** no background job in MVP. When a new link is created in a group, the group's inactive links (expired or exhausted) are deleted in the same locked transaction. Inactive tokens are not valid, but remain in plain text until then. `shortcut: inactive links in inactive groups remain until the group creates a new link or is deleted, upgrade with periodic cleanup if the database grows or the requirement changes`.

**Endpoints (calendar, see `docs/services.md`):**
- `POST /api/groups/{groupId}/invite-links`: member. Body `{maxUses}` where `maxUses` is an optional integer 1–10. Omitted or `null` gives 10. Creates a new link and responds 201 with `id`, `token`, `createdByUserId`, `expiresAt` (RFC 3339, UTC), `useCount` (0) and `maxUses` (always an integer). Errors: `invalid_request` (400, invalid JSON or a wrong JSON type, checked first), `group_not_found` (404), `invalid_max_uses` (400).
- `GET /api/groups/{groupId}/invite-links`: member. Lists the active links the caller may see: for a member their own links, for an admin all group links. Inactive ones are not shown. Each item has `id`, `token`, `createdByUserId`, `expiresAt`, `useCount` and `maxUses`. The response has `Cache-Control: no-store`. No `canRevoke`: every link in the list can be revoked by whoever sees it. The server decides what is listed, so the frontend does not need to decide rights. The frontend translates `createdByUserId` to a display name using the member list.
- `DELETE /api/groups/{groupId}/invite-links/{linkId}`: the link's creator or the group's admin. Other members get `403 not_allowed`. A non-member gets `404 group_not_found`. An inactive link (expired or exhausted) cannot be revoked: the response is `404 invite_invalid` and nothing changes (REQ-0007). Other cases delete the row. The link's ID is used in the path, not the token, so that the token does not end up in logs. The order is permission first, then state.

**No automatic link:** links are created only on request. `POST /api/groups` creates the group and the admin membership, but no link. Revocation does not create a new link. A group can therefore be without active links.

**Leaving a group:** links created by the member are deleted in the same transaction (ADR 0004). Otherwise a departed member's link would keep letting in new members.

**Joining:**
- `GET /api/invites/{token}` returns the group's name if the link is active.
- `POST /api/invites/{token}/join` creates the membership according to the step list above.
- An unknown, revoked, expired or exhausted link gives `404 invite_invalid` (a link of a member who has left is deleted, so it is unknown). The response is identical in all cases. The group's name and ID are not shown.
- Join is idempotent for existing members: the same response as for a new join, and no new membership or new use. Role and `joined_at` do not change.

**Frontend:** `invite_invalid` is shown as a 404 page without group information. The text lives in the frontend (ADR 0001). The group's page shows active links with expiry time (`expiresAt`) and uses, for example "3 of 10 uses". The form for a new link has a selector 1–10 with 10 preselected, and sends the chosen value. The preselection in the form is UI state, not a rule: the rule is the default in the API. The page `/invite/{token}` loads no resources from third parties. `Referrer-Policy: same-origin` is set by `edge` for all responses (ADR 0009), so that the token does not leak via Referer.

**Logging:** the token is treated as a secret. No log of any container (`edge`, `gateway`, `frontend`, `auth`, `calendar`, `postgres`) contains the token:
- request logs write the paths `/api/invites/{token}`, `/api/invites/{token}/join` and `/invite/{token}` with `:token` instead of the value, and no log contains a query string (ADR 0002 and ADR 0009, amendment review 4);
- `frontend` writes no access log, and both Nginx containers write their error log at level `emerg` only, because Nginx error lines carry the request line (ADR 0008 and ADR 0009, amendment review 5);
- PostgreSQL logs no bind values (ADR 0008, amendment review 5), and adapters never put a token into an error message;
- response bodies containing a token are never logged.

**Admin role** is set when the group is created (the creator) and granted by an admin to a member with `PUT /api/groups/{groupId}/admins/{userId}`. It is transferred automatically when the last admin leaves (ADR 0004). The role gives the right to see, copy and revoke all active group links, and to make a member admin. It gives no other authority in MVP.

**Rate limiting:** none in MVP for invite endpoints. The token cannot be guessed, and abuse requires either a membership in the group or a leaked link. Invite endpoints therefore get no extra infrastructure. If abuse becomes visible in operations, the next step is a domain rule, a limit on the number of active links per member, not rate limiting. That would change this ADR or replace it with a new one.

## Consequences
- A leaked link gives access to the group's member list and lobbies until it is revoked, expires or reaches its max. At most 2 hours after creation, and at most `max_uses` (1–10) joins.
- **Abuse (bots):** the per-link limit caps how many accounts a single link can bring in. Each join requires a Discord account and a login. The per-link limit does not limit the number of links: a member can create several links within their 2 hours. That requires a membership, and it is the remaining limit, see Rate limiting above.
- Admins can read other members' tokens. This follows from the decision. An admin is already a member and can create their own links, so no new access is granted.
- Each link requires a creation event. The group therefore needs an explicit action to get a link, which is acceptable for small groups.
- Cleanup is a DELETE in a locked transaction that already runs when a link is created. No extra infrastructure.
- Exhausted links are a new path to `invite_invalid`. It gives the same response as expiry and revocation, so nobody can tell them apart.
- The limit 10 is both in the domain constant and in the database check. A change therefore requires a new migration. This is intentional, because the limit is a rule and not an environment setting.
- REQ-0002 and REQ-0007 still contain assumptions that are replaced: "one link at a time", "new link is created directly", "expiry date out of scope", "admin does not copy others' links", "The link is not valid" as text, and an optional max number of uses where empty means unlimited. The product owner updates the requirements. The design follows the user's decision.
- The chosen 404 behavior gives no difference between a revoked, expired, exhausted and unknown link. That is a prerequisite for REQ-0007.

## Alternatives considered
- **One active link per group with rotation** (earlier proposal): replaced by the user's decision on several links.
- **Expiry time computed from `created_at` on each read:** a changed constant would then silently change the validity of existing links, and the API would have to recompute the value.
- **Background job for cleanup:** an extra process to delete a few rows per group. Cleanup at creation is enough.
- **Hash of the token:** listing and copying links become impossible, both for members and admins.
- **`revoked_at` with history:** REQ-0007 excludes history. A delete is simpler.
- **Deleting all links when the last admin leaves:** removes links that members rely on, for no reason.
- **Admin sees a count but not tokens:** conflicts with the user's decision that admins copy others' links.
- **Max uses that can be changed after creation:** no such request exists. The link is revoked and a new one created instead (YAGNI).
- **Short codes (e.g. 6 characters):** guessable, and would then require rate limiting and a table of attempts.
- **Token in a query string (`?token=`):** ends up in logs and in browser history more easily. (The login `returnTo` carries `/invite/<token>` for one redirect; that case is accepted with reasons in ADR 0005, amendment review 5.)
- **Signed JWT as invite:** cannot be revoked without a list, and carries more data than necessary.
- **Unlimited as an option (empty max):** the user's decision is that all links have a max, to counter bots.
- **Mandatory `maxUses` in the body:** would force every client to choose. The default in the API is enough, and the form shows 10 as default.
- **Default in the database (`default 10`):** the rule would live in two places. The default lives in the domain.
- **Max as configuration (environment variable):** no requirement says the limit should change per environment (same reason as `InviteLinkLifetime`).
- **Rate limiting on invite endpoints in MVP:** protects against guessing, which is already impossible with a 256-bit token. It costs infrastructure without protecting against anything that exists in MVP.

Amendment 2026-11-01: the field `createdBy` in `InviteLink` is named `createdByUserId` (ADR 0001). The name follows the database's `created_by_user_id`. An invalid form of the token gives the same `404 invite_invalid` as an unknown token, never 400.

Amendment 2026-11-01 (review 2):
- **No `createdAt` in the API.** `InviteLink` has `id`, `token`, `createdByUserId`, `expiresAt`, `useCount` and `maxUses`. No criterion uses the creation time. The column `created_at` stays in the table as an operations column (ADR 0006) and is never returned.
- **No "left" state.** A link is deleted when its creator leaves (ADR 0004, rule 5b, same transaction). A link is active when it exists, `expires_at > now` and `use_count < max_uses`. The creator's membership is not checked separately.
- **`maxUses`:** omitted or `null` gives 10. An integer outside 1–10 gives `invalid_max_uses`. A wrong JSON type (text, decimal, boolean) gives `invalid_request` (ADR 0001). This replaces "a wrong type gives `invalid_max_uses`".
- **Revoke order** (`DELETE /api/groups/{groupId}/invite-links/{linkId}`): 0. shape: an invalid uuid in the path, from left to right (`groupId` gives `group_not_found`, `linkId` gives `invite_invalid`), before the membership check (ADR 0001 consolidated, item 1); 1. membership, else 404 `group_not_found`; 2. the link exists in this group, else 404 `invite_invalid`; 3. the caller is the creator or a group admin, else 403 `not_allowed`; 4. the link is active, else 404 `invite_invalid`; 5. delete, 204. An invalid form of `linkId` gives `invite_invalid` (ADR 0001, step 1).
- **Invalid token** in `GET /api/invites/{token}` and `POST .../join` gives `invite_invalid` (unchanged).

Amendment 2026-11-01 (review 4):
- **A member can learn that a link ID exists in their group.** On `DELETE .../invite-links/{linkId}` a member who is not the creator gets `403 not_allowed` for a link in their group and `404 invite_invalid` for an unknown one. Accepted: the ID is a random uuid that cannot be guessed, it is not the token, and it gives no access. The group scoping (a link ID from another group gives the same 404 as a missing one) is ADR 0004 rule 12.
- Logging of the token: see "Logging" above (rewritten in place in review 5 to cover `frontend` and `postgres`).
