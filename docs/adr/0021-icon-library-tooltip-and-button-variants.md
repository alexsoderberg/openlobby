# 0021. Icon library, tooltip and button variants

Status: Proposed (2026-11-11)
Requirement: none. Visual improvement requested by the user, decided by the orchestrator on 2026-11-11.
Amends: none. Replaces the button sizes and colour rules in `frontend/src/styles/global.css` (section "Primary button is solid accent").

## Context
- Buttons share three classes in `frontend/src/styles/global.css`: `.button` (primary), `.button-ghost` and `.button--secondary`. Ghost and secondary look the same. Every button is at least `--size-tap` (2.75rem, 44px) high.
- Icons are hand-drawn SVG in `frontend/src/features/shell/icons.tsx` (tab bar, rail) and `frontend/src/ui/ViewToggle.tsx` (list, calendar). They use the same stroke style as Lucide.
- Icon-only buttons need an accessible name and a visible hint. Today there are none.
- Frontend dependencies: React 19, openapi-fetch, three. No icon or tooltip library.
- Modularity rules (CLAUDE.md): a new dependency goes behind one adapter, and vendor types do not leave it.
- Colour tokens already exist: `--color-danger` (text and border) and `--color-danger-bg` (fill), in `global.css`.
- WCAG criteria applied: 1.4.11 (icon and focus contrast 3:1), 1.4.13 (tooltip hoverable, dismissible, persistent), 2.4.7 (focus visible), 2.5.8 (target at least 24x24 CSS px), 4.1.2 (name).

## Decision

**1. Icon library: `lucide-react`, pinned exactly to `1.60.0`.**
- License ISC, `sideEffects: false`, so only the icons used are bundled. Peer dependency React 19 is accepted.
- Version `1.60.0` was published 2026-10-20, three weeks before this ADR. The latest, `1.72.0`, was published today and is not used. At implementation the pin is checked against the registry again. The `package.json` entry has no caret (`"lucide-react": "1.60.0"`), as for `three`.
- Only one file imports the library: `frontend/src/ui/Icon.tsx`. It exports the component `Icon` with the prop `name: IconName` and an optional `className`. `IconName` is a project-owned string union. One map `IconName -> Lucide component` in that file is the only place that knows Lucide names. `LucideIcon` and every Lucide type stay in that file.
- Lint rule in `frontend/eslint.config.js`: `no-restricted-imports` with the group patterns `lucide-react` and `lucide-react/*`, for all files under `src/`, except `src/ui/Icon.tsx`. Replacing the library means rewriting that one map and that one import.
- `IconName` grows with the screens that need an icon. There is no preloaded set (YAGNI).
- `Icon` renders at `1em` square and takes its colour from `currentColor`, with `aria-hidden="true"` and `focusable="false"`. Stroke width is 1.8 as in the hand-drawn icons.
- The five hand-drawn icons move to the library, and `icons.tsx` is deleted, so there is one icon source.

**2. Tooltip: own component `Tooltip` in `frontend/src/ui/Tooltip.tsx`, no library.**
- `Tooltip` is used only by `IconButton` (point 3). It shows `label` in a bubble beside its child.
- Shown on pointer enter and on keyboard focus (the target matches `:focus-visible`, so a mouse click does not open it). Hidden on pointer leave and on blur.
- Escape closes it. It opens again on the next pointer enter or focus. No extra state is needed for this.
- Persistent and hoverable: the bubble is a child of the wrapper and its box touches the trigger with no gap, so the pointer can move onto it without leaving the wrapper (WCAG 1.4.13).
- The bubble is `aria-hidden="true"`. The text is already the accessible name, so no `aria-describedby` is needed.
- Wrapper: a `span` with `position: relative; display: inline-flex`. The bubble is `position: absolute`, above the trigger, centred.
- **Coarse pointers (touch): the bubble is hidden with `@media (pointer: coarse) { display: none }`.** There is no tooltip on touch. The label is shown on the button instead (point 3).
- Motion: a fade with the existing duration token. The `prefers-reduced-motion: reduce` block in `global.css` already sets `transition: none`, so no code is added.

**3. Icon-only button: `IconButton` in `frontend/src/ui/IconButton.tsx`.**
- Props: `icon: IconName`, `label: string`, and the usual button props (`onClick`, `type`, `disabled`).
- It renders `<Tooltip label={label}>` around `<button class="button-ghost button--icon" aria-label={label}>`, containing `<Icon name={icon} />` and `<span class="button__label">{label}</span>`. One `label` value sets both the accessible name and the tooltip text. This is true by construction; the test checks it once for `IconButton`.
- Fine pointers (mouse, keyboard): the label span is hidden (`display: none`). The button shows the Icon alone, square 2rem, round (`border-radius: 50%`). The label is in the tooltip.
- Coarse pointers: the label span is shown beside the Icon. The button is no longer square; its height is 2.5rem. The short label is the visible text, so the label text must be short (one or two words).
- Disabled: `disabled` attribute, as all buttons in the codebase. A disabled button is not focusable, so its tooltip is not reachable by keyboard. This is accepted: an unavailable action needs no hint, and its label is still its accessible name when the user reaches it by other means.
- Used for edit, copy and other secondary actions. Never for a danger action (a danger action always has visible text, see point 4).
- Focus ring: the existing `:focus-visible` rule in `global.css` applies. PR1 checks on a round button that the ring is visible and meets 3:1 against the background (WCAG 2.4.7, 1.4.11).

**4. Button variants: CSS classes for text buttons, no `Button` component.**
The codebase already uses the classes in about 50 files (`className="button"`), so a component would be a rewrite of all of them. The change is in CSS, plus `IconButton` for the icon case.

Variant set (one variant per text button; `IconButton` always uses the ghost look):

| Class | Look | Used for |
|---|---|---|
| `.button` (primary) | filled accent, as today | the main action of a view: Create lobby, Join, Save (one per view) |
| `.button--secondary` | surface fill, 1px neutral border | secondary text actions, e.g. Invite |
| `.button-ghost` | no fill, no border, text colour; surface on hover | low-emphasis text actions, and `IconButton` |
| `.button--danger` | no fill, 1px `--color-danger` border, `--color-danger` text | every destructive action: Remove, Leave group, Revoke. Always with visible text |
| `.button--icon` (modifier of `.button-ghost`, set by `IconButton` only) | see point 3 | edit, copy and other secondary icon actions |

- Destructive actions are always text, never icon-only. A destructive action must be recognisable on every device, and the icon alone is not enough on touch.
- Size: one size per pointer type, not a size axis (YAGNI).
  - Fine pointers: height `--size-button: 2rem` (32px), horizontal padding `--space-3`, no vertical padding, 1px border. The primary keeps its inset highlight; the others lose it.
  - Coarse pointers (`@media (pointer: coarse)`): height `--size-button-touch: 2.5rem` (40px) for every button, which is the hit area on touch.
- Icon + text (any variant): `Icon` inside the button, gap `--space-2`.
- Colour contrast: icons take the button's text colour, which must meet 3:1 against the background (WCAG 1.4.11). The existing text colours already do; PR1 checks the danger text.
- Hover lift, sweep and disabled styles stay as they are.

**5. Delivery plan (small PRs).**
Every file in the frontend that uses a button class or an icon is assigned below. Files that render a plain `<button>` without these classes do not change. Test files move with the component they test.

- **PR1, foundation, no screen changes:** `lucide-react` 1.60.0 dependency; `ui/Icon.tsx` with the names used by PR2 and PR3; `ui/Tooltip.tsx`; `ui/IconButton.tsx`; button styles in `global.css` (fine and coarse sizes, variants, `.button--icon`, `.button__label`); the eslint rule; tests:
  - Tooltip: shows on pointer enter and on focus-visible focus, hides on leave and blur, closes on Escape, stays open while the pointer moves onto the bubble.
  - IconButton: accessible name equals the tooltip text; the button is a named button, not only an icon.
  - Icon: renders an SVG with `aria-hidden`.
  - Note: the CSS change restyles every existing button at once. This is intended, and the reviewer checks the screens in PR1.
- **PR2, screens not in flight:**
  - `features/shell`: `AppShell.tsx`, `CreateGroupButton.tsx`, `GroupContextMenu.tsx`, `GroupRail.tsx`, `TabBar.tsx`; `icons.tsx` is deleted; tests `AppShell.test.tsx`.
  - `features/groups`: `CreateGroupForm.tsx`, `GroupDetails.tsx`, `LeaveGroupAction.tsx` (danger text), `MakeGroupAdminAction.tsx`; tests `CreateGroup.test.tsx`, `MyGroups.test.tsx`, `app/MakeGroupAdmin.test.tsx`.
  - `features/invites`: `CreateInviteLinkForm.tsx`, `InviteAction.tsx`, `InviteLinkList.tsx`, `InviteLinks.tsx`, `InvitePage.tsx`, `RevokeInviteLinkControl.tsx` (Revoke as danger text); tests `InviteLinks.test.tsx`, `InvitePage.test.tsx`.
  - `features/login/LoginPanel.tsx`, `features/profile/ProfilePage.tsx`, `features/landing/LandingPage.tsx`.
  - `ui/ConfirmDialog.tsx`, `ui/ErrorAlert.tsx`.
  - Tests `app/App.test.tsx`, `app/LoggedInApp.test.tsx`, `app/navigation.test.tsx` change only where they assert a button, in the same PR as the screen they cover.
- **PR3, after the in-flight UI work on lobbies and the admin game form is merged:**
  - `ui/ViewToggle.tsx` (its `ListIcon` and `CalendarIcon` are removed, which breaks `ThisWeek.tsx` and `Lobbies.tsx`, so they move in the same PR).
  - `features/dashboard/ThisWeek.tsx` and its tests `ThisWeek.test.tsx`, `Dashboard.test.tsx`.
  - `features/lobbies`: `CreateLobbyForm.tsx`, `Lobbies.tsx`, `LobbyCalendar.tsx`, `LobbyDetailPage.tsx`, `LobbyDetails.tsx`, `LobbyMembership.tsx`, `SeatChoice.tsx`, `SeatForm.tsx`; all `Lobb*.test.tsx`, `CreateLobby*.test.tsx`.
  - `features/games`: `GameForm.tsx`, `GameList.tsx`, `GameStructureFields.tsx`; tests `GameStructure.test.tsx`, `GamesPage.test.tsx`.

Each PR is reviewed on its own. The reviewer reviews PR1 against this ADR as the rule set.

## Consequences
- One new external dependency: `lucide-react`, ISC, exact pin. Each upgrade is a separate PR that changes only the pin and checks `Icon.tsx`.
- Visual change everywhere from PR1: fine-pointer buttons are about 27% smaller in height (44px to 32px). Primary is the only filled button. Expect visual review in PR1, PR2 and PR3.
- Icon-only buttons on touch show their short label, so they are wider than on a mouse screen. The label text is short by convention and checked in review.
- Destructive actions are never icon-only. This departs from the example list in the user's brief, where "remove" was also named as icon-only; remove is a text danger button here.
- The tooltip behaviour (Escape, focus-visible, hover onto bubble, hidden on coarse) needs tests; these parts are the most likely to regress.
- A disabled icon button is not keyboard reachable, so its tooltip is not reachable either. Accepted (see point 3).
- Glossary rows added to `CLAUDE.md`: Icon, Tooltip, Button variant, Icon-only button.

## Alternatives considered
- **Keep the hand-drawn icons and add only new icons from Lucide.** Two sources and two naming schemes. Rejected.
- **Other icon sets (Heroicons, Phosphor, Tabler).** Same cost, no advantage over Lucide, whose style already matches the existing icons. Lucide is the user's decision.
- **Radix or another tooltip library.** A new dependency for a small component that we can test ourselves. Rejected (YAGNI, one dependency at a time).
- **Native `title` attribute as tooltip.** Not shown on keyboard focus or on touch, not dismissable, and not stylable. Rejected for WCAG 1.4.13.
- **Tooltip sets `aria-label` on its child by cloning it.** Works, but needs `cloneElement` and hides the coupling. `IconButton` sets the label itself, in one place. Rejected.
- **A `Button` component with `variant` and `size` props.** Clearer API, but every call site would change at once, and the migration would be one large PR. CSS classes allow the screen-by-screen migration. Reconsider when a third size or state logic appears in more than one place.
- **Hit area via `::before` pseudo-element.** The primary button's hover sweep needs `overflow: hidden`, which clips the extra area. Rejected; the 2.5rem box on coarse pointers is used instead.
- **Transparent border to extend the hit area.** Works, but adds a hidden trick for one case. Rejected.
- **Tooltip on touch via long press.** Adds gesture logic and a hidden feature; the visible label solves the same need. Rejected.
