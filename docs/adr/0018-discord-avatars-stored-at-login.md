# 0018. Discord avatars: picture stored at login, served to members by calendar
Status: Proposed (2026-11-10)
Requirement: REQ-0016 (F-029).
Amends: ADR 0003 (auth owns the picture bytes), ADR 0005 (the rule "Avatar is not fetched" is replaced), ADR 0002 (one new route, to `calendar`). Introduces one external endpoint, Discord's image CDN, which is a new external dependency and therefore needs this ADR.

## Context
- REQ-0016: a person's Discord picture is shown wherever their name is shown, with no opt-out. The picture is taken at login and changes at the next login. A removed picture gives initials. A picture that cannot load gives initials and no error. The Next up card shows no names and no pictures. Group icons stay initials (REQ-0012).
- DECISION (user, 2026-11-10): a picture is served only when the viewer and the picture's owner share a group now. A viewer always sees their own picture. This overrides REQ-0016's "last one known" for members who have left (see Consequences).
- `auth` owns identity and stores only the display name today (`users`, ADR 0003). ADR 0005 excluded avatars as YAGNI. Calendar gets names from `auth` on each read through `POST /internal/users/lookup` and keeps no copy (ADR 0003).
- `auth` has no group data. Membership is owned by `calendar` (ADR 0003, ADR 0004). If `auth` had to ask `calendar` for membership on each picture, and `calendar` asks `auth` for names, the two services would call each other at runtime.
- The gateway is the only public entry and sets the identity headers (ADR 0002). Services trust those headers only.
- Privacy: if the browser loads the picture from Discord's CDN, Discord learns each viewer's IP address, a content security policy must allow Discord's host, and a Discord URL would enter the API contract.
- Load: a Raspberry Pi 5 with 8 GB (ADR 0008). A picture at 128 px is a few kilobytes.

## Decision

**1. Storage: `auth` keeps the bytes.** `users` gets no image column. A new table holds them:

```sql
CREATE TABLE user_avatars (
    user_id uuid PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    image   bytea NOT NULL CHECK (octet_length(image) BETWEEN 1 AND 65536)
);
```

Migration `0002_user_avatars.sql` (goose, `down` drops the table). The limit 65536 mirrors the named constant `maxAvatarBytes` in `auth`. The table is provider-neutral: no column names a provider. The runtime role gets DML through the default privileges of `infra/postgres/init`, which cover tables; no sequence is used.

**2. Login (ADR 0005, step 3) takes the picture.** After the user row is created or updated:
- `ExternalIdentity` gets `AvatarRef`, the provider's picture reference, empty when the user has no picture. The Discord adapter maps the `avatar` field of `/users/@me`. The scope stays `identify`.
- `AvatarRef` empty: the `user_avatars` row is deleted. The user sees initials.
- `AvatarRef` set: the application calls the port `AvatarSource.Fetch(ctx, identity) ([]byte, error)`. The Discord adapter requests the 128 px image from the CDN with the named timeout `avatarFetchTimeout` (3 seconds). It accepts only `Content-Type: image/png` and at most `maxAvatarBytes`.
- The application then checks the PNG signature (the 8 bytes `89 50 4E 47 0D 0A 1A 0A`) with the domain rule `domain.IsPNG`. Bytes that are not a PNG are refused. This is the validation at the boundary, where external bytes enter.
- On success the row is upserted. On any failure (timeout, error status, wrong type, too large, not a PNG) the login still succeeds, the stored picture stays unchanged, and a warning is logged with the request ID and no URL. REQ-0016 names this fallback. The next login tries again.

**3. Access and delivery: `calendar` serves the picture to members.**
- Public route `GET /api/users/{userId}/avatar` (operation `getUserAvatar`, in `api/calendar/openapi.yaml`). The gateway checks the session and routes to `calendar`.
- Calendar application use case `Avatars.Picture(ctx, viewerID, ownerID, ifNoneMatch)`:
  a. `viewerID == ownerID`: allowed.
  b. Otherwise the port `SharesGroup(ctx, viewerID, ownerID) (bool, error)`, implemented in the postgres adapter by an `EXISTS` self join on `group_members` (both sides use the primary key or `group_members_user_id_idx`). Not a shared group: 404 `avatar_not_found`, the same answer as for no picture, so no group information is revealed.
  c. The port `PictureSource.Fetch(ctx, ownerID, ifNoneMatch)`, implemented by the `authclient` adapter, calls `auth`'s internal endpoint (point 4).
  d. The answer: 200 with the bytes, 304 when `auth` answers 304 for the tag, 404 when `auth` has no picture, 503 `service_unavailable` when `auth` does not answer (fail closed: no picture, and the browser shows initials).
- Internal endpoint in `auth`, `GET /internal/users/{userId}/avatar` (operation `getUserAvatarInternal`, in `api/auth/internal.yaml`). No session and no membership check, because `auth` has no group data. The protection is the gateway, which answers every `/internal/*` path from clients with 404 (ADR 0002). The `services` network also contains the gateway (ADR 0008), so the network alone does not protect this endpoint. It answers the bytes, the ETag, 304 on a matching `If-None-Match`, and 404 when there is no picture.
- Response headers from `calendar`: `Content-Type: image/png`, `ETag: "<hex SHA-256 of the bytes>"` (quoted, as HTTP requires), `X-Content-Type-Options: nosniff`, and `Cache-Control`:
  - every picture, the viewer's own and other members': `private, no-cache`. The browser revalidates with the ETag on each view. A new picture after login shows at once, and a former member gets 404 at their next view, so no picture stays usable after leaving the group. A 304 carries no body.
- `auth` sets the same `Content-Type`, `ETag` and `nosniff` on its internal answer.

**4. The views get a flag, not a URL.**
- Internal `UserName` (`api/auth/internal.yaml`) gets `hasAvatar` (boolean, required). `POST /internal/users/lookup` computes it with `EXISTS` on `user_avatars` in the same query, so no extra call is made.
- Calendar's port `UserDirectory` returns a profile `{DisplayName, HasAvatar}`.
- Public `UserRef` (`api/calendar/openapi.yaml`) gets `hasAvatar`, optional in the schema and always sent (`x-omitempty: false`, as in ADR 0017). `Member`, `LobbyPlayer` and the feed user (ADR 0020) inherit it.
- In a group view, `UserRef.hasAvatar` is the `auth` flag AND the user is a current member of that group. For member lists, players and creators this is the `auth` flag. For a feed event by someone who has left, it is false, and the line shows initials. The check is one query for the group's member IDs.
- `AuthUser` (`GET /api/auth/me`, `api/auth/openapi.yaml`) gets `hasAvatar`, required in the response. The top bar and the You page use it, with `userId` from the same response.
- The contract carries no URL. The frontend builds `/api/users/{userId}/avatar` from the ID, in one place.

**5. Frontend.** One component `PersonAvatar` (in `frontend/src/ui`, next to `Avatar`) with `userId`, `name` and `hasAvatar`:
- With `hasAvatar`: the picture, in a box of the same size as the initials circle, so the layout does not move. `alt=""`, because the name is written next to it and is announced once.
- Without it, or when the image fails (`onError` on `<img>`): the initials from the existing `Avatar`. An image event is not a `catch`, so the code rule on errors is not touched.
- `Avatar` stays the initials component for group icons, which never get a picture (REQ-0012).

Every place a person's name is shown renders `PersonAvatar` in the same element. Places found in the frontend today:
- member list, `features/groups/GroupDetails.tsx` (`member.displayName`);
- invite link creator, `features/invites/InviteLinkList.tsx` (creator name, shown in the link row);
- lobby row "Created by", `features/lobbies/LobbyList.tsx` (`creatorName`);
- lobby player list, `features/lobbies/LobbyDetails.tsx` (`player.displayName`);
- admin confirmation dialog, `features/groups/MakeGroupAdminAction.tsx` (`memberName`): the picture sits beside the name in the dialog's text;
- top bar, `features/shell/TopBar.tsx`, and You page, `features/profile/ProfilePage.tsx` (own name, own picture);
- the feed (ADR 0020).

Checked, no person name today: the week view, the day list and Next up (REQ-0012 shows no names there). Reviewer rule: `rg -n "displayName|creatorName\(|memberName" frontend/src --glob "*.tsx" --glob "!*.test.tsx"`. Each hit renders `PersonAvatar` in the same element, or the hit is listed as a non-person text.

**6. Content security policy.** No CSP is set today. When one is added it allows `img-src 'self'` and no Discord host. The frontend never loads a Discord URL.

**7. Vendor boundary.** The CDN host and its path format live only in `services/auth/internal/infrastructure/discord`. The domain and application know `AvatarRef` and the bytes. Changing the provider means a new adapter for `IdentityProvider` and `AvatarSource`. The table format is the same for every provider.

**Ports.**
- `auth` (application): `AvatarSource` (used by the login), `AvatarRepository` (`Save`, `Delete`, `Find`), implemented by the postgres adapter. The domain provides `IsPNG`.
- `calendar` (application): `SharesGroup`, `PictureSource`, `UserDirectory` (extended). `PictureSource` is implemented by the `authclient` adapter.

**Dependencies.** The Discord image CDN (`cdn.discordapp.com`) is a new external endpoint, used only by `auth` at login, over HTTPS, through the existing `auth-egress` network. No new Go module: `net/http` only.

ASSUMPTIONS to verify when building:
- The `avatar` field is returned by `/users/@me` under the `identify` scope.
- The CDN returns a PNG at size 128 for animated pictures too (the first frame). The user has decided that animated pictures show their first frame.

## Consequences
- Login can take up to 3 seconds longer when the CDN is slow.
- A picture changed at Discord shows after the owner's next login. A removed picture shows initials after the next login.
- A member who has left the group sees initials, not their last picture. This follows the DECISION above and REQ-0016's "last one known" line is superseded by it. The product owner updates the requirement.
- `auth` stores about 10 KB per user. It is included in the backup of the `auth` database (ADR 0008).
- Cost per picture view, when the browser asks: one gateway session check (`auth`), one `EXISTS` query (`calendar`), one primary key read (`auth`). A group of 15 costs 15 of each per page view, because every view revalidates. The 304 answers skip the body, so the bytes are read only on a changed picture. There is no server-side cache. Shortcut: `shortcut: no server-side picture cache, upgrade with an in-memory cache keyed by owner and ETag if the Pi shows load`.
- A former member's browser asks again at the next view and gets 404, so no picture remains usable after leaving the group.
- A failed fetch at login keeps the old picture. There is no retry during the day.
- No container gains state.

## Delivery in small PRs
Build starts after ADR 0017 is finished (its PR6 merged).

| PR | Scope | Owner | Needs |
|---|---|---|---|
| A-1a | `auth`: migration `0002_user_avatars` with up, down and an integration test. `ExternalIdentity.AvatarRef`, `AvatarSource`, `AvatarRepository`, `domain.IsPNG`, the login rules (empty, fetched, failed, not PNG) with domain and application tests. Discord adapter for the CDN with fake-server tests. `hasAvatar` in the lookup. `GET /internal/users/{userId}/avatar` with 200, 304, 404 and the headers. `api/auth/internal.yaml` (`UserName.hasAvatar`, `getUserAvatarInternal`) and `api/auth/openapi.yaml` (`AuthUser.hasAvatar`, required), generated code. | backend-expert | none |
| A-1b | `calendar`: `GET /api/users/{userId}/avatar` in `api/calendar/openapi.yaml` (operation `getUserAvatar`, error `avatar_not_found`), generated code. Ports `SharesGroup` (postgres adapter) and `PictureSource` (`authclient`, regenerated for `getUserAvatarInternal`). Use case `Avatars.Picture`, handler with the headers. Gateway route `GET /api/users/{userId}/avatar` to `calendar` with session. Tests: own picture allowed; shared group allowed; no shared group gives 404 and does not call `auth`; `auth` down gives 503; 304 forwarded; 404 from `auth` gives 404. Gateway test: `GET /internal/users/{userId}/avatar` and any other `/internal/...` path give 404 `not_found` and reach no upstream. | backend-expert | A-1a |
| A-2 | `calendar`: `UserRef.hasAvatar` in `api/calendar/openapi.yaml`. `UserDirectory` returns the profile. The group rule (auth flag AND current member) in the group views. Mapping in `Member` and `LobbyPlayer`. Generated code. Tests: flag true for a member with a picture, false for a member without, false for a non-member with a picture. The 100 and 101 ID limit tests keep passing. | backend-expert | A-1a |
| A-3 | `PersonAvatar` with the picture, fallback, fixed size, `alt=""`. Used in every place listed in point 5, and in the top bar and the You page (`hasAvatar` from `/me`). Tests per place: a picture when `hasAvatar`, initials when not, initials after an image error, the name text appears once. Layout test: the box size is the same for picture and initials. | ui-ux-expert | A-1a, A-2 |

DevOps: none. No CSP exists, and the path needs no edge change.

## Not built now (YAGNI)
Upload or choice of a picture, pictures other than Discord's, a privacy setting, resizing or conversion, a server-side picture cache, a version in the URL, a retry of failed fetches, signed URLs.

## Alternatives considered
- **Browser loads the picture from Discord's CDN.** Discord sees each viewer's IP address, the CSP must allow Discord's host, and a vendor URL enters the API or the frontend. Rejected.
- **Proxy each view to Discord, nothing stored.** Every cache miss is an external call at view time, a Discord outage hits the views, and an old picture file may disappear after a change at Discord, which breaks "the old picture stays until the next login". Rejected.
- **`auth` serves the picture and checks membership by calling `calendar`.** Each view then needs a call from `auth` to `calendar`, while `calendar` already calls `auth` for names: a runtime cycle between two services. Rejected.
- **`auth` serves the picture with no membership check.** Any logged-in user who knows an ID could fetch it. Rejected by the user's DECISION.
- **Membership copied into `auth`.** A second copy of group data (ADR 0003, DRY). Rejected.
- **Store the bytes in `calendar`.** `calendar` does not own identity, and the picture would be a copy of `auth` data. Rejected.
- **A separate image service or a disk cache.** A new service, or state in a container. Rejected (CLAUDE.md, ADR 0008).
- **Signed, expiring image URLs.** A key and token design for a read that the gateway and calendar already authorize. Rejected (YAGNI).

## Open questions
- None for the user. The animated-picture question is answered: the first frame is shown.
