# 0024. Role icons: a column on game roles and role slots, a fixed set in the contract
Status: Proposed (2026-11-13)
Requirement: REQ-0023 (F-042). Builds on ADR 0017 (game roles; lobby role slots are copies), ADR 0022 (preferred game roles), ADR 0016 (the genre pattern: a text column with a CHECK and an enum in the contract, a `Record` over the enum in the frontend) and ADR 0021 (project icon names, one mapping in `ui/Icon.tsx`). Adds migration 0009 (two nullable columns in `calendar`), one field to four schemas and one error code. No new service, dependency or asynchronous communication.

## Context
- REQ-0023: a system admin picks one icon per game role from a fixed set, or "No icon", in the game form. The form suggests an icon from the role's name, and nothing is saved before the form is saved. A lobby's role slots keep the icon they were copied with, as they keep their name (ADR 0017).
- "Without choosing an icon" (REQ-0023) means: the admin picked no icon by hand, and the form had no suggestion to save. The form then shows "No icon", and "No icon" is saved. A suggestion that is saved unchanged is the admin's choice and is saved as that icon (REQ-0023: the suggestion is only a prefill).
- Two states must be told apart. A role that was never saved with a choice (every role that exists today) gets the suggestion when the form opens. A role the admin saved with "No icon" must not get the suggestion again, or every later save would add an icon the admin removed.

## Decision

### 1. Storage (`calendar`, migration `0009_role_icons.sql`)
- `game_roles.role_icon text` and `lobby_role_slots.role_icon text`, both nullable, each with a CHECK that lists the seven values below. Text with a CHECK, not a PostgreSQL enum: the same as `games.genre` (ADR 0016), and a value can be added or removed by changing the CHECK.
- `NULL` means "not chosen yet". `'none'` means the admin chose "No icon". The API shows both as no icon; the form suggests only for `NULL`.
- No backfill. Existing game roles keep `NULL` and get the suggestion in the form. Existing lobby slots keep `NULL`: they had no icon when they were copied.
- Down migration: drops both columns. A rollback loses only the icons, and the admin can choose them again.

### 2. Contract (`api/calendar/openapi.yaml`)
- The field is `roleIcon`. This confirms the glossary's ASSUMPTION. Schema `RoleIcon`: string enum `shield`, `medical-cross`, `dagger`, `crosshair`, `wrench`, `star`, `none`. The names are the project's own (ADR 0021).
- Response fields: `GameRole.roleIcon` (the game form, the game list), `RoleSlot.roleIcon` (lobby copy), `PreferredGameRole.roleIcon` (the You page and member names; read live from the game role, as its name is). Nullable, `x-omitempty: false`, not in `required`, as ADR 0017 did for new fields. The field description says that the server always sends it: `null` means not chosen yet, `none` means "No icon".
- Request: `GameRoleInput.roleIcon` is optional. The server stores an omitted or `null` value as `'none'`. The form always sends an explicit value: the icon the admin picked, the suggestion if it was saved unchanged, or `none` for "No icon". A value outside the enum gives 400 `invalid_role_icon`. Order after the game role checks: name (`invalid_game_role`), slots (`invalid_capacity`), icon (`invalid_role_icon`).
- No request field for create, join or the seat choice. The seat choice reads the icon from `roleIcon` of the game role in the game tree that the create form already reads (`GET /api/groups/{groupId}/games`, ADR 0017), because there is no lobby yet. On join it reads `roleSlots` of the lobby.

### 3. Rules in `calendar`
- Domain: the seven values as constants and one check function. Nil gives `none`; a value outside the list gives `invalid_role_icon`. A unit test compares the constants with the generated contract enum, so the two lists cannot drift apart. The test lives in `transport`, where the generated types are: the domain does not import them.
- A lobby copies `role_icon` with each role slot, at creation and at a mode change (ADR 0017). Later changes of the game role's icon, name or removal do not change the lobby.
- The game role write (ADR 0017 section 6) writes the icon in the same insert as the name. No extra step.

### 4. Suggestion (frontend only)
- One table in the game form module, typed by the generated `RoleIcon`: `Record<RoleIcon, readonly string[]>`, the role names that suggest each icon. A name matches after trim, ignoring case: `shield` for `Tank`; `medical-cross` for `Support`, `Healer`; `dagger` for `DPS`, `Damage`; `crosshair` for `Sniper`, `Ranged`; `wrench` for `Engineer`. `star` and `none` have no names. No other name gives a suggestion. DECISION (user, 2026-11-13): this is the full list. The `Record` type makes a new contract value a compile error until it has an entry.
- The suggestion is a prefill, saved only with the form. Nothing computes it on the server: that would copy the knowledge into a second place and make the API guess.
- DECISION (user, 2026-11-13): the suggestion applies to a row whose icon is `NULL` when the form opens. While the admin has not picked an icon by hand, the suggestion follows the name as it is typed. Picking an icon by hand, including "No icon", stops the following. A suggestion saved unchanged is saved as that icon.
- ASSUMPTION (architect, 2026-11-13, to confirm with the user): an existing role follows the typed name in the same way as a new row. The user's answer covered new rows. Both rows have the name in the same form, so the same rule keeps the form consistent.
- A stored `'none'` or a stored icon is never changed by the suggestion. Only `NULL` at open is prefilled.
- Icon names: `IconName` (ADR 0021) includes the six role icon names, written as `Exclude<RoleIcon, "none">` from the generated type. The glyph map `Record<IconName, LucideIcon>` in `ui/Icon.tsx` then fails to compile until every role icon has a glyph. The display code narrows `roleIcon` to that type, with no cast. `ui/Icon.tsx` is the only `ui` file that imports from the generated contract.

### 5. Display (frontend only)
- Shown with the name, before it, by one component that renders `Icon` (ADR 0021) with `aria-hidden`; the name is the text. On role slots ("Tank 0/1"), on the lobby player group headings, in the seat choice of create and join, and on preferred game roles (You page, next to names).
- Not shown on Flex, on Next up or This week labels, or when `roleIcon` is `null` or `'none'`.

## Consequences
- Two nullable columns and one more selected column in the game tree and the role slot reads. No extra query and no extra call.
- Adding an icon later is a contract enum change, a CHECK change in a new migration, and one entry in the glyph map and the suggestion table (the compiler lists both). Acceptable for a fixed set.
- The `none` value and `null` look the same on screen. Code must treat both as "no icon", and only the form reads `null` as "suggest".
- `ui/Icon.tsx` depends on the generated `RoleIcon` type. This is one type import, and it keeps the icon names and the contract in one list.

## PR slices
| PR | Owner | Scope | Tests |
|---|---|---|---|
| PR1a | backend-expert (opus) | Contract (`RoleIcon` schema, the four `roleIcon` fields, error code `invalid_role_icon`), generated Go and TS types in the same PR; migration 0009 up and down; domain values and check; game role write and game tree read. Lobby slots keep `NULL` until PR1b | Unit: nil gives `none`; unknown value gives `invalid_role_icon`. Transport: 400 `invalid_role_icon`, the check order (name, slots, icon); `roleIcon` always present (`null` when unset); constants equal the generated enum. Integration: migration up and down; an omitted icon is stored as `none`; the CHECK refuses an unknown value; the game tree read returns the stored icon |
| PR1b | backend-expert (opus) | Lobby copy of `role_icon` at create and at a mode change; `roleSlots` on lobby reads; preferred game roles read carries `roleIcon` | Integration: a lobby keeps its icon after the game role's icon, name or removal changes; create copies the icon; a mode change copies the new mode's icons; a preferred game role shows the current icon of its game role. Transport: `RoleSlot.roleIcon` present |
| PR2 | ui-ux-expert (opus) | `IconName` role names and glyphs in `ui/Icon.tsx`; the suggestion table and function; the icon select with text labels and "No icon" in the game form; prefill and follow rules; save | Table test of the suggestion: each listed name, case and spaces, other names give none, `star` never. Form: prefill only for `null`; a typed name is followed until an icon is picked by hand; picking "No icon" stops it; a suggestion saved unchanged is saved as that icon; an existing `'none'` is not overwritten; "No icon" is saved as `none`; the saved icon shows after save; the select has labels, not icon-only |
| PR3 | ui-ux-expert (opus) | The display component in role slots, player group headings, the seat choice of create (game tree) and join (`roleSlots`), and preferred game roles on the You page and next to names | Component: icon `aria-hidden`, name read as text; no icon for Flex, `null` or `none`; no icon on Next up or This week labels; the create seat choice shows the icon from the game tree; the join seat choice shows the icon from `roleSlots`; the You page shows the icon of each preferred game role; the icon is not smaller than the text on a phone |

Order: PR1a, then PR1b, then PR2, then PR3 (same owner, one after the other). PR2 before PR3, because PR3 uses the icon names. DevOps: none. `docs/services.md` is updated by the architect in this change, not by a PR of this ADR.

## Alternatives considered
- PostgreSQL enum type: cannot drop a value, and each change needs its own DDL. Rejected, as for genre.
- Separate table for role presentation: one attribute on the row that already has the name and slots. Rejected.
- Library icon names in the API (`shield`, `Sword`): vendor names would leak into the contract (ADR 0021). Rejected.
- Only `NULL` for "No icon": the suggestion would return on every form open after the admin chose "No icon". Rejected.
- Suggestion on the server: a second copy of the name rules and a guess in the API. Rejected.
- Backfill existing roles with `'none'`: contradicts REQ-0023, which gives existing roles the suggestion in the form. Rejected.

## Open questions
- Only the ASSUMPTION in section 4 (existing rows follow the typed name) is to be confirmed by the user. The other rules were answered by the user on 2026-11-13.
