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

Amendment 2026-11-02 (REQ-0002 design check). Decided by the architect before implementation. These are mechanics and names; the decisions above do not change.

**1. Token storage (confirmed).** Plain text: `invite_links.token text unique not null` (ADR 0006). The reasons above hold: members and admins must be able to copy links again. A hash is rejected.

**2. Token generation (decided).** Port `TokenGenerator` in `calendar/internal/application`, method `NewToken() (string, error)`. Adapter `cryptotoken` in `calendar/internal/infrastructure`: 32 bytes from `crypto/rand`, encoded with `base64.RawURLEncoding` (43 characters). This is the same port and adapter name as in `auth` (ADR 0003). The code is duplicated in each service and not moved to `pkg/`: it is about 10 lines, and the rule of three is not reached.

**3. Time (decided).** The `Clock` port (ADR 0004) is read after the group lock in join, create and revoke. Create sets `created_at = now` and `expires_at = now + InviteLinkLifetime` (2 hours). `InviteLink.IsActive(now)` is true when `now` is before `expires_at` and `use_count < max_uses`. A link with `expires_at == now` is not active.

**4. One error for every inactive case (decided).** The application returns the domain error `ErrInviteInvalid` for: token unknown; group row missing at the lock; link missing in this group (revoke); link not active. The transport writes the envelope with `invite_invalid` and no other data. The 404 bodies differ only in `requestId`. There is no check of the token's form: a value that matches no row gives `invite_invalid`, which is also the answer the contract gives for an invalid form.

**5. Order of the join (decided; the steps of "Check and count at join", with the lock first).** Lock the group, read the link again (`WHERE id = $1 AND group_id = $2`, ADR 0006 rule 12), `IsActive(now)` else `invite_invalid`, then: if the caller is a member, return the group and change nothing; otherwise insert the membership (`joined_at = now`) and run `UPDATE invite_links SET use_count = use_count + 1 WHERE id = $1 AND group_id = $2`, all in the same transaction. The membership check comes after the lock, so a double click by one person creates one membership.

**6. Order of create (decided).** Lock the group, membership (`group_not_found`), `NewInviteLinkMaxUses` (`invalid_max_uses`), delete the group's inactive links, insert. Validation runs after the lock to keep the order of the contract. `NewInviteLinkMaxUses` is a pure domain function and reads no data.

**7. Lists and invite page (decided).** `listInviteLinks` reads the links without a lock (all of them for an admin, the caller's own for a member) and filters with `IsActive(now)` in `application`. `getInvite` reads the token without a lock.

**8. `InviteInfo` gets `groupId` and `isMember` (decided; contract change in `api/calendar/openapi.yaml`).** REQ-0002 requires that a member who opens an active link goes to the group's page, with no membership and no use counted. The invite page can only do that if it knows the group and whether the caller is already a member. The rule in "Joining" above (the group's name and ID are not shown) applies to inactive links. For an active link the group ID is shown to the token holder. It gives no access: a non-member gets `404 group_not_found` for that group.

**9. Empty body (decided).** `createInviteLink` has an optional body. A request with no body is treated as `{}`: 201 with `maxUses` 10. The backend pins this with a transport test. If the generated decoder rejects an empty body, the transport maps an empty body to `{}` before decoding. This needs no contract change.

**10. Delivery order of revoke (decided by the orchestrator, review item B3).** REQ-0002 delivers `revokeInviteLink` for group admins only, because REQ-0002's acceptance criterion is about the admin. Revoke by the link's creator belongs to REQ-0007 and comes as its own PR later. The contract keeps the final rule ("the link's creator or a group admin", see Endpoints above). Until REQ-0007 is delivered, a member who is not an admin gets `403 not_allowed`, the answer the contract defines for a caller who is not permitted. This holds also for the creator of the link, who is not an admin: until REQ-0007 is delivered, a creator who is not an admin gets the same answer as any other member. The contract's `403 not_allowed` response for `revokeInviteLink` already covers this, so no contract change is needed for it. The order of checks is unchanged: membership, link exists in this group, permission, link active. REQ-0007's acceptance tests (creator, admin, other member, inactive link, cancelled confirmation) are added with its PR.
**Superseded in part by Amendment 2026-11-03 (S2d):** the creator may revoke their link, delivered with S2d. The rest of item 10 stands.

**11. Request body limit (decided, no new ADR).** `httpapi.LimitBody` already exists in `pkg/httpapi` (ADR 0001, item 3) and `auth` uses it. `calendar` adds it to its router after `requireUserID`. It stays in `pkg/`, because it is pure HTTP middleware used by two services.

**12. Timing of the 404 (accepted, review COULD).** The three 404 cases (unknown, inactive, group gone) are identical in body and headers, but not in timing: an inactive link needs one more read than an unknown one. This is accepted. A token has 256 bits of entropy (item 2), so timing reveals nothing that can be guessed.

**13. `getInvite` when the group row is gone (decided).** `getInvite` reads the link and the group name in one query. If the group row is gone, the query returns no row, so the answer is `invite_invalid`, the same as for an unknown token.

**14. Backups and dumps are secrets (consequence, review COULD).** Database dumps and backups contain live tokens (item 1, plain text by decision). Access to dumps and backups is limited like access to the database. A dump is never added to the repository, never sent to a log, and never shared without the same care as the database itself.

Amendment 2026-11-03 (REQ-0002 PR A). Item 11 of the amendment above says "after `requireUserID`", which reads the list order as the execution order. As built, `requireUserID` runs first and `httpapi.LimitBody` runs inside it, just before the handler. The router order is in ADR 0004, Amendment 2026-11-03.

Amendment 2026-11-03 (S2b: cleanup at create, token collision). The rules above stand; these are two explicit points.
- **Cleanup predicate in SQL (decided, deliberate exception to "the rule lives in one place" in Active link).** The delete of a group's inactive links at create (`deleteInactiveInviteLinksSQL` in `infrastructure/postgres/invite_links.go`) repeats the condition of `InviteLink.IsActive(now)` in SQL, and nothing else does. Option (b), reading the group's links under the lock and letting the domain pick the IDs, was rejected: it adds a port method, a delete-by-IDs method and a query, and changes no outcome. Every read path still uses `IsActive`, so a row that is inactive but not yet deleted is never shown, joined or revoked. The condition is limited to cleanup: no read or access decision may use the SQL predicate. Both sides must stay equal. The integration test pins the boundaries: `expires_at == now` is deleted and kept as not active, `use_count == max_uses` is deleted and kept as not active, and a link one second before expiry with uses left is kept. A change to `IsActive` requires the same change in the SQL in the same PR.
- **Token collision (accepted).** A unique violation on `invite_links.token` (SQLSTATE `23505`) during insert is not retried. It gives `500 internal_error`, logged with the request ID. The log line must not contain the token: `PgError.Error()` excludes `Detail`, and adapters never put a token into an error message (see Logging). With 256-bit tokens the case is practically impossible, so no retry loop is built (YAGNI). The user can create the link again.

Amendment 2026-11-03 (S2d: revoke by the creator). Delivers the creator's right from item 10 of the 2026-11-02 amendment, which had deferred it to REQ-0007.
- **Who may revoke (decided):** the link's creator (`createdByUserId`) or a group admin. Other members get `403 not_allowed`. This is the rule of Endpoints above, now in force.
- **Check order (as built, matches "permission first, then state"):** membership (`404 group_not_found`); link in this group (`404 invite_invalid`, the same for an unknown or foreign ID); permission (`403 not_allowed`); link active (`404 invite_invalid`); delete (`204`). The membership and existence checks are lookups that come before permission. The state check comes last, so a non-permitted caller learns nothing about whether an inactive link exists.
- **Code names:** `Revoke` and `revokeLocked` in `application/invite_links.go`; the locked delete is `GroupTx.DeleteInviteLink`.
