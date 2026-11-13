# 0023. UI base: shadcn/ui components, Radix primitives, sonner toasts

Status: Accepted (2026-11-13)
Requirement: REQ-0022 (product owner, Decided) covers the toasts: placement, duration, pause, the nine places and the layering. This ADR implements it.
Amends ADR 0021:
- point 2 (Tooltip): the Tooltip is Radix Tooltip wrapped in `ui/Tooltip.tsx`. The reason "a new dependency for a small component" no longer holds (see 1a). The A3 amendment (top-layer popover) is superseded. The touch rule and "used by `IconButton` only" stay. The rejected alternative "Radix or another tooltip library" (ADR 0021, line 104) is overturned.
- point 3 (`IconButton`): its API stays; it is built on `Button`.
- point 4 (button variants): a `Button` component replaces the classes (see 1b). The rejected alternative "A `Button` component with `variant` and `size` props" (ADR 0021, line 107) is overturned.
Supersedes, in `docs/superpowers/specs/2026-11-03-dark-luxury-ui-design.md` (not edited here): the non-goal "No animation or UI library, no CSS framework, no CSS-in-JS." (spec line 23), for the component and CSS parts of this ADR; the radius figures (point 3); and inline copy feedback (point 4). The rejection of a motion library stands (user, 2026-11-12).

## Context

The user decided (translated from Swedish):
- 2026-11-12: use shadcn/ui as the base, so that we do not build every animation and behaviour ourselves; sonner for toasts; a tighter style (radius), so the UI does not look generic; one or two more spectacular details per page.
- 2026-11-13: "I want more of the application to be built with shadcn, e.g. buttons. Animations etc. will be better if we use ready-made components and animations, at least to some extent." Toasts in the bottom-right corner, fading out after a few seconds.
- 2026-11-13, answers to the open questions: Button, toasts, Dialog (AlertDialog, with Radix open and close animation), Tooltip (Radix), DropdownMenu and Popover are adopted. The native select stays for the phone pickers. Checkbox, RadioGroup and Tabs are not adopted now. About +100 KB gzipped in total is accepted. Invite link created and revoked are toasts too, as REQ-0022 lists.

The pilot (uncommitted, based on main 733804d) added Tailwind through Vite, copied shadcn's AlertDialog and sonner, and changed the radius tokens. The user saw almost no difference. The pilot changed how the source is built, not what is drawn: colours and spacing still come from the same tokens.

Facts on main a231db5: `frontend/src/styles/global.css` (2,366 lines) holds the design tokens in `:root`. About 30 non-test files use `.button*` classes. `ui/` has 14 components. `ConfirmDialog` (native `<dialog>`) has six feature callers and no test file of its own. `Popover` is the create-form frame (it scales out of the "+", with a scrim). `GroupContextMenu` is a hand-built menu with one item. `Select` is native and stays. Tests read `global.css`: `styles/motion.test.ts`, `styles/tokens.test.ts` and others. The base styles are phone-first; from 47.5rem the tab bar (`--size-tab-bar`) and the floating "+" (`.plus-button--fab`) are hidden.

Why a library for behaviour, not React alone. React gives the state and the markup. It does not give a focus trap with focus return, Escape and outside-click dismissal, placement that stays inside the window, or a wait for the exit animation before unmounting. Writing these by hand for Dialog, DropdownMenu, Popover and the toaster is most of their code and tests. ADR 0021 accepted a hand-built tooltip; with the other overlays in the bundle, the same positioning code is now worth sharing. Radix gives the behaviour with no styles, so the look stays ours. sonner gives the toast queue, timers, pause and live region.

## Decision

### 1. Components

| Component | Decision | Replaces | Kept, and why |
|---|---|---|---|
| Button (shadcn) | Adopt, PR B2 | the `.button*` classes and their rules in `global.css` | the `IconButton` API |
| Dialog (Radix AlertDialog) | Adopt, PR C | the native `<dialog>` of `ConfirmDialog`, its `.dialog` styles | the `ConfirmDialog` props |
| Toast (sonner) | Adopt, PR D | the inline success statuses of the nine places in REQ-0022 | errors stay inline (ADR 0013, 0014) |
| Tooltip (Radix) | Adopt, PR E | the hand-built positioning and dismiss logic of `Tooltip.tsx` | the `label` prop; touch hides the bubble |
| DropdownMenu (Radix) | Adopt, PR F | `GroupContextMenu` (hand-built, one item) | nothing else |
| Popover (Radix) | Adopt, PR G | the hand-built frame of `ui/Popover.tsx` | the scrim and the scale from the "+" (`--origin-x`, `--origin-y`) |
| Select | Not adopted | nothing | native select keeps the OS pickers on phones |
| Checkbox, RadioGroup, Tabs | Not adopted now | nothing | native inputs already have the keyboard behaviour; no tabs in the app. Their own ADR if a requirement needs them |
| Avatar | Not adopted | nothing | initials and image fallback are ours (ADR 0018) |

**1a. Tooltip.** The adopted set brings floating-ui in with DropdownMenu and Popover anyway. Two positioning systems would be one too many, so the tooltip uses the same primitive. Radix gives the placement, hover grace, Escape and focus handling; `ui/Tooltip.tsx` keeps the props and the touch rule. Delay: 0 ms, as today. Its bubble is a portal, so it leaves the top layer (A3 superseded).

**1b. Button.**
- Source: shadcn/ui's `button`, copied to `frontend/src/ui/Button.tsx` with a header comment naming the source. Edited: class lists (point 2), variant names, and no `asChild` (no Radix Slot in our code) and no `class-variance-authority` (a plain object).
- API: `<Button variant="primary" | "secondary" | "ghost" | "danger" size="default" | "icon" type disabled onClick>`. The names are the glossary's. Feature code writes no button class names.
- Hook for `global.css`: `data-slot="button"`. Press and hover motion, and the sibling-spacing rules that name `.button` (`global.css` around lines 2228 to 2260, and `.list-row :is(.button, .tooltip)`), move there too.
- Sizes keep their token values; the touch size uses the `pointer-coarse:` variant. Screenshots show no size change.
- `IconButton` renders a `Button` with `variant="ghost"` and `size="icon"`.
- `.plus-button--fab` is a floating control, not a text button. It is not part of this migration.

### 2. Tailwind and `global.css`

- Tailwind 4 through `@tailwindcss/vite`. Used for CSS utilities only, and only for classes in `frontend/src/ui/`.
- `global.css` imports the utilities and scans `ui/` only:
  ```css
  @import "tailwindcss/utilities.css" layer(utilities) source(none);
  @source "../ui";
  ```
  No `theme.css` and no preflight. Tailwind's default palette, radius and spacing scale are then absent: `bg-red-500` or `rounded-lg` produce no CSS. The element resets stay in `global.css`.
- **One source for tokens.** Values stay in `:root` of `global.css`. No `@theme`, no alias layer and no shadcn variables. A utility reads a token directly: `bg-(--color-bg-raised)`, `rounded-(--radius-control)`. ASSUMPTION: Tailwind 4.3.3 maps `bg-(--x)` to `background-color`. PR B2 checks it; if not, the typed form `bg-(color:--x)` is used. The test below accepts either.
- **Cascade.** Utilities sit in a layer, so any unlayered rule in `global.css` wins over them.
  - a. A `ui/` component takes its colour, radius and box from its utilities. `global.css` does not style those on a `ui/` element.
  - b. A feature passes `className` only to place a component (width, or a margin from its parent). That feature rule wins over the utility, on purpose.
  - c. A `ui/` root sets no margin.
- **Motion is not Tailwind's.** Classes in `ui/` contain no `transition*`, `duration-*`, `ease-*` or `animate-*`. Motion is written in `global.css` with tokens. Open, closed and checked states are styled by `[data-state]` selectors in `global.css`, not by `data-[state]:` utilities, so that `motion.test.ts` sees every transition.
- **Motion source: own keyframes, not tw-animate-css.** Radix Presence keeps an element mounted until its exit animation ends, so the open and close motion is needed for every adopted dialog, popover, menu and tooltip. Our keyframes are short and animate `transform` and `opacity` only. tw-animate-css is not used: its keyframes animate `filter: blur()`, which the motion rule forbids, and it would be imported outside `global.css`, where `motion.test.ts` does not read it.
- **Focus.** One `:focus-visible` rule in `global.css` for all components. Copied `ring-*` and `focus-visible:` classes are removed.
- **Typography.** Font, weight, size and line height of a `ui/` component are in `global.css` under `[data-slot]`, next to its motion. `font-*`, `text-<size>`, `leading-*` and `tracking-*` are not used in `ui/`.
- **Dark only.** No `dark:` variants.
- **Test environment.** Radix Popper needs `ResizeObserver`. A polyfill goes once in `frontend/src/test/setup.ts`, in the first PR whose tests render a Popper (PR E at the latest).
- **Tests** (PR B2, `styles/uiClasses.test.ts`, reads `frontend/src/ui/**/*.tsx`):
  1. no class contains `-[` (arbitrary value), and none contains `dark:`, `ring`, `shadow`, `transition`, `duration-`, `ease-`, `animate-`, `font-`, `leading-` or `tracking-`;
  2. every colour or radius class names a token, `(--...)`;
  3. every `(--name)` used in `ui/` is defined in the `:root` of `global.css`. An undefined token renders nothing and fails silently.
- **Reviewer rule for features.** A `className` in `features/` names a class defined in `global.css`. A Tailwind class there generates nothing and does not fail visibly.

### 3. The look stays ours

- Every value comes from a token. The copied source loses its defaults: the palette, shadows, rings, `dark:` variants, animation classes and the default radius scale. Only class lists are edited; structure, names and markup stay as in shadcn.
- Radius: the user decided on 2026-11-12 on a tighter style. The figures are the architect's proposal, to be confirmed in the browser check before PR B1 is merged: `--radius-panel` 16 to 12 px, `--radius-popover` 26 to 16 px, `--radius-control` 10 to 8 px, `--radius-badge` 6 to 4 px. `--radius-chip` stays a pill. Icon-only buttons stay round (ADR 0021). The check blocks PR B1 only.
- Signature details: at most two per page, marked `signature: <page>` in the code, and the user approves each page's list before PR H. Shared base motion is not a signature.
- Each copied file is reviewed against its shadcn source. The diff may change only class lists, variant names and imports.

### 4. Toasts

- `sonner` 2.0.8, exact. `frontend/src/ui/Toast.tsx` is the only file that imports it. It exports `Toaster` and `showToast(message: string)`. Callers pass text that is already translated through `src/i18n` (ADR 0013); `Toast.tsx` does not translate. `Toaster` is mounted once, in the app root under `frontend/src/app/`.
- `position="bottom-right"`, `expand={false}`, `visibleToasts={1}`, `unstyled`. The classes in `Toast.tsx` use tokens.
- Product rules, from REQ-0022 (DECISION, user, 2026-11-13): the bottom-right placement, the 4 s duration, the pause while the pointer is over a toast or keyboard focus is inside the toast region, and the phone position. The 16 px margin from the window edges is an ASSUMPTION in REQ-0022. This ADR implements them; the requirement is the source.
- `const TOAST_DURATION_MS = 4000;` in `Toast.tsx`. sonner pauses its timer on hover (PR D checks it in a test) and on focus (ASSUMPTION until PR D verifies it).
- **Layering: above dialogs and popovers.** A native `<dialog>` (`showModal`) and a native popover sit in the top layer, which is above every z-index, so a toast cannot get above them. That is why PR C (the Dialog family) comes before the toasts. After PR C the Dialog is a Radix portal. The Popover, Tooltip and DropdownMenu follow in PRs E to G. Until PR E the Tooltip is still a native popover in the top layer, so a toast can sit under an open tooltip, for example the copy button's tooltip on keyboard focus. This gap is accepted as short-lived: a tooltip is a short bubble, not a dialog or popover, and PR E closes it. After PR G every overlay is a portal with z-index values below 60 (the highest in `global.css` today). sonner's toaster uses its own z-index (999999999 in its stylesheet), so the toaster is above them. PR D's test `styles/zIndex.test.ts` asserts that every literal z-index in `global.css` is below 1000 and that the toaster is not in the top layer. PR D also checks in a browser that a toast stays visible while the create-lobby form and a confirm dialog are open.
- **Fade out.** sonner removes a toast 200 ms after dismissal (`TIME_BEFORE_UNMOUNT = 200` in 2.0.8). The exit transition is `--duration-fast` (0.1 s); the entry is `--duration-base`.
- **Reduced motion.** Toasts follow the global reduced-motion block in `global.css` (transitions and animations off, final state shown). They get no rule of their own.
- **Motion guard.** sonner 2.0.8's own stylesheet sets `transition: transform .4s, opacity .4s, height .4s, box-shadow .2s` on `[data-sonner-toast]`, outside `global.css`. The override in `global.css` is `[data-sonner-toaster] [data-sonner-toast] { transition-property: transform, opacity; }` with the durations from tokens. Its specificity (0,2,0) beats sonner's one-attribute selector in any stylesheet order. If PR D finds sonner's selector is more specific, the specificity is raised; `!important` is not used. PR D's test `Toast.test.tsx` reads the computed transition of a rendered toast, with `global.css` injected through `test/cssTokens`, and asserts that only `transform` and `opacity` are listed.
- **Exit is a fade.** sonner's exit moves the toast by its own height (`--y`) and goes to opacity 0. REQ-0022 says "fades out", so `global.css` sets `transform: none` on the removed state (`[data-sonner-toast][data-removed="true"]`; ASSUMPTION: the attribute name, checked in PR D). The exit is then opacity only.
- **Phones (below 47.5rem).** The toast sits above the floating "+", which sits above the tab bar, and never covers the tab bar:
  `--toast-bottom: calc(var(--size-tab-bar) + env(safe-area-inset-bottom) + var(--size-plus-tab) + 2 * var(--space-3))`, in the base rules of `global.css` (phone-first). The wide layout (from 47.5rem) sets `--toast-bottom: var(--space-3)`, the 16 px margin. The toaster's offset is `{ bottom: "var(--toast-bottom)", right: "var(--space-3)" }`, so the same value applies at every width, and sonner's `mobileOffset` is not used: sonner switches to mobile at 600 px, the app at 760 px, and the two would disagree between them. On phone screens without the "+", the toast sits one button-height higher than needed; one value for all screens is kept on purpose. ASSUMPTION: sonner applies an offset string as a CSS length. PR D checks at 390 px and 800 px.
- **Which messages.** The nine places of REQ-0022's table: invite link copied, created and revoked; group created; group left; game added, changed and removed; lobby created when the lobby is not visible; lobby mode or activity saved; game set. Never errors, validation, live-update notices or messages with an action. The copy failure stays inline, as REQ-0022 says. A message is a toast or an inline status, never both; sonner's live region announces it once (a PR D test).

### 5. Dialog, tooltip, menu, popover

- **Dialog (PR C).** `ConfirmDialog` keeps its props and its look. It becomes a Radix AlertDialog (`ui/Dialog.tsx`, copied and trimmed to Content, Title, Description, Action and Cancel). The open state moves inside `ConfirmDialog`, so that Radix can run the exit animation before the content unmounts. The owner is then told through `onClose` after the exit, not at once. The six callers change: `DeleteGameDialog`, `GameStructureFields`, `LeaveGroupDialog`, `MakeGroupAdminDialog`, `DeleteLobbyDialog` and `LobbySettings` remove their item in `onClose`, not in `onConfirm`. ASSUMPTION: Radix calls `onCloseAutoFocus` after the exit has ended; PR C checks it. Keep, Escape and the overlay close the dialog; a refusal stays in the dialog (as today). `ConfirmDialog` has no test file today; PR C adds `ConfirmDialog.test.tsx`.
- **Tooltip (PR E).** `ui/Tooltip.tsx` wraps Radix Tooltip with the `label` prop and its own trigger. The label is the accessible name of the button (ADR 0021 point 3); Radix's description must not read the label a second time (PR E checks it in a test). Touch: the bubble is hidden with `@media (pointer: coarse)` as today.
- **DropdownMenu (PR F).** `GroupContextMenu` moves onto `ui/DropdownMenu.tsx`, copied from shadcn and trimmed to Trigger, Content and Item. Radix gives arrow keys, typeahead, Escape and focus return.
- **Popover (PR G).** `ui/Popover.tsx` becomes a Radix Popover. The scrim stays our element, styled as today. The scale from the "+" keeps the `--origin-x` and `--origin-y` variables. Radix gives Escape, outside-click dismissal and focus return; modal or non-modal is chosen in PR G so that the create form's tests stay green.
- Shared rule for all four: the open and close motion is in `global.css` under `[data-state]` (keyframes of transform and opacity only); reduced motion shows the final state at once (the existing block in `global.css`).
- A helper `ui/classNames.ts` joins class names (one function, used by five copied components). No `clsx`, no `tailwind-merge`.

### 6. Migration plan (small PRs, one per component family)

Rollout order (user, 2026-11-13): the shadcn rollout starts right after ADR 0022 PR5 (backlog A3a) and comes before A4 to A6. Order (DECISION, user, 2026-11-13: "Yes, Dialog first"): Button → Dialog → Toasts → Tooltip → Menu → Popover. The toasts come after the Dialog family, not directly after Button: REQ-0022 requires a toast above an open dialog, and a native dialog stays in the top layer until PR C.

| PR | Content | Owner | Tests and checks |
|---|---|---|---|
| 0 | This ADR, CLAUDE.md Stack line and glossary rows | architect | reviewer: no BLOCKER (docs-only) |
| B1 | Tailwind wiring and tokens: the packages, `global.css` `@import` and `@source`, radius token values (point 3). Nothing else changes | ui-ux-expert | suite green; screenshots of each page at desktop and phone width; the user checks the radius in a browser before merge |
| B2 | `ui/Button.tsx`; `IconButton` on `Button`; `[data-slot="button"]` rules in `global.css`; `styles/uiClasses.test.ts`. The old `.button*` rules stay until the last B PR | ui-ux-expert | `uiClasses.test.ts`, `motion.test.ts`, `tokens.test.ts` green; button tests: class names out, role and name tests stay; screenshots show no size change; ASSUMPTION: without preflight, `border` utilities need a style, checked here |
| B3, B4, ... | Migration of the call sites, one PR per group of screens (for example: shell and login; groups and invites; lobbies; games and profile). Each PR compares screenshots. The last B PR deletes the `.button*` rules and their spacing selectors | ui-ux-expert | the feature tests of the group; at the end `grep` finds no `.button` or `button--` class |
| C | Dialog family (point 5): `ConfirmDialog` on Radix AlertDialog; six callers change; `ConfirmDialog.test.tsx` new | ui-ux-expert | Keep gets focus, Escape closes, a refusal stays, success closes and the owner acts in `onClose`; `motion.test.ts` green; reduced motion shows the final state |
| D | Toast family (point 4): `ui/Toast.tsx`, the mount, the copy and save call sites and the other seven REQ-0022 places; their inline statuses are removed in the same PR | ui-ux-expert | `Toast.test.tsx`: one toast, read once in the live region; computed transition (point 4); the exit is opacity only; `zIndex.test.ts`; placement at 390 px and 800 px; a toast over the create-lobby form and a confirm dialog checked in a browser |
| E | Tooltip family (point 5): `ui/Tooltip.tsx` on Radix Tooltip; the `ResizeObserver` polyfill | ui-ux-expert | `Tooltip.test.tsx` and `IconButton.test.tsx`: hover and focus-visible open, Escape closes, touch hides, name not read twice; changed only where Radix behaves more correctly, and the reviewer approves each change |
| F | DropdownMenu family (point 5): `GroupContextMenu` on `ui/DropdownMenu.tsx` | ui-ux-expert | menu tests: arrow keys, Escape, focus return, item action |
| G | Popover family (point 5): `ui/Popover.tsx` on Radix Popover | ui-ux-expert | `popover.test.ts` and the create form tests green; scale from the "+" unchanged in the screenshots |
| H | Signature details (point 3), one page at a time, each after the user approves the page's list | ui-ux-expert | `motion.test.ts` green; the reviewer counts `signature:` markers per page; screenshots |

Not adopted: Select, Checkbox, RadioGroup, Tabs, Avatar (point 1). Each gets its own ADR and a requirement first.

### 7. Pins, dependencies and bundle size

Exact pins for the packages added by this ADR (existing caret ranges in `package.json` stay). Versions resolved in the pilot's install; the registry is checked in each PR:

| Package | Pin | Kind | Used for |
|---|---|---|---|
| `sonner` | 2.0.8 | dependency | toasts (PR D) |
| `@radix-ui/react-alert-dialog` | 1.2.1 | dependency | Dialog (PR C) |
| `@radix-ui/react-tooltip` | 1.4.1 | dependency | Tooltip (PR E) |
| `@radix-ui/react-dropdown-menu` | 2.2.1 | dependency | DropdownMenu (PR F) |
| `@radix-ui/react-popover` | 1.3.1 | dependency | Popover (PR G) |
| `tailwindcss` | 4.3.3 | devDependency | CSS utilities in `ui/` (build only) (PR B1) |
| `@tailwindcss/vite` | 4.3.3 | devDependency | Tailwind in the Vite build (PR B1) |

- Individual `@radix-ui/react-*` packages, not the `radix-ui` umbrella (1.8.1 in the pilot). Each primitive is one reviewed pin, which matches the "one package per primitive" rule. The umbrella brings about thirty packages into the tree and the lockfile for four primitives.
- Transitive packages (`@radix-ui/react-dialog`, `-presence`, `-popper`, `-portal`, `@floating-ui/*`) are pinned by the lockfile, not by us.
- Vite plugin, not PostCSS: the project uses Vite 8; the plugin is one line in `vite.config.ts`, with no `postcss.config`.
- Not added: `radix-ui`, `clsx`, `tailwind-merge`, `class-variance-authority`, `tw-animate-css`, `components.json` and the `@/` alias. The copied source uses relative imports and one helper (point 5).

Bundle size. Gzipped, minified, React external, Vite 8 builds from the pilot's `node_modules`:

| Module set | Gzip |
|---|---|
| sonner 2.0.8 alone | 10.3 KB |
| Radix alert-dialog, tooltip, dropdown-menu and popover together (shared core counted once) | 41.2 KB |
| All of the above together | 50.9 KB |
| Tailwind utilities for `ui/` (the shadcn source alone is 0.5 KB; the components add more classes) | about 1 KB (estimate) |

Added by this ADR: about 52 KB gzipped JS and CSS (upper bound). Within the accepted total of about +100 KB. The measurement imports each package as a namespace, so no tree-shaking happens: the real figure is lower. The pilot's entry chunk was 138.8 KB gzipped with sonner and AlertDialog in it; the baseline without them is estimated at 113 KB (ASSUMPTION), so the entry after this ADR is about 165 KB gzipped (estimate). Lazy loading of the menus, popovers and dialogs is not done now (YAGNI); it is an option if the entry grows further.

Raspberry Pi: it serves the frontend's static files (ASSUMPTION: the frontend container serves files, `infra/`). Its cost is disk and transfer, not CPU. A phone downloads about 52 KB gzipped more on first load, and the rest is cached.

### 8. Modularity

- Each vendor sits in one `ui/` file: sonner in `Toast.tsx`, each Radix package in its own wrapper (`Dialog.tsx`, `Tooltip.tsx`, `DropdownMenu.tsx`, `Popover.tsx`). Features import only from the `ui` index. Replacing a vendor touches its wrapper, not the features.
- Tailwind is visible only in `ui/` class lists and one line of `vite.config.ts`.
- Lint: `no-restricted-imports` for `sonner` and `@radix-ui/*` outside `frontend/src/ui/`, with the message "Use the ui component (ADR 0023 point 8)".

## Consequences

- Most of the app's chrome comes from shadcn and Radix: buttons, dialogs, tooltips, menus and popovers. Behaviour (focus, Escape, placement, exit motion) is ready-made; the look is ours, from tokens.
- The Button family changes about 30 feature files in PRs B3 and later, class names only. The six `ConfirmDialog` callers change in PR C, because the owner acts after the exit.
- A `ui/` component has two homes: its look (utilities in its file) and its motion and type (`global.css`). Both are covered by tests.
- Five runtime packages and two dev packages are added. About 52 KB gzipped more JS and CSS.
- A Tailwind class in `features/` does nothing silently. The reviewer rule and the `ui/` test are the guard.
- The visible change is larger than in the pilot: buttons, radius, dialog and menu motion, toasts. Signature details come on top, one page at a time.

## Alternatives considered

- **The pilot as it stands** (AlertDialog, sonner, Tailwind with the theme, `clsx`, `tailwind-merge`, the `radix-ui` umbrella, `components.json`): rejected. The helper packages are not needed, and the umbrella pulls in thirty packages.
- **Tailwind for the whole app (draft option A):** rejected. About 66 files that use `className` would be rewritten.
- **Tailwind `@theme` aliases to the tokens (pilot):** rejected. It is a second naming layer, and `--color-accent` (the app accent) collides with Tailwind's colour namespace.
- **tw-animate-css:** rejected for the reasons in point 2.
- **Native `<dialog>` with CSS `@starting-style` (no Radix):** rejected. The user asked for Radix open and close animation, and the exit then needs `allow-discrete`, which the motion test does not cover.
- **Toasts before the Dialog family (the user's order, read literally):** rejected for now. A native dialog in the top layer would hide a toast, which REQ-0022 forbids.
- **Toaster in the top layer (`showPopover`):** rejected. It would need reopening on every toast, and the stacking order would depend on call order.
- **Radix `radix-ui` umbrella:** rejected (point 7).
- **Lazy loading of the Radix parts now:** not done (YAGNI). Revisit if the entry grows.
- **A motion library:** rejected (user, 2026-11-12).

## Notes

- Measured: the sizes in point 7 (Vite 8 builds from the pilot's `node_modules`); `TIME_BEFORE_UNMOUNT` in sonner 2.0.8; the versions of the Radix packages in the pilot's install; the positions of `.tab-bar` and `.plus-button--fab` in `global.css`; the line count of `global.css` (2,366).
- Not measured: Firefox and Safari behaviour; Tailwind's `bg-(--x)` on 4.3.3 (PR B2); sonner's offset, pause, exit and selector specificity (PR D); Radix's `onCloseAutoFocus` timing (PR C); the final build (recorded in each PR).

## Open questions

1. REQ-0022 open question 1 (the list view). Owned by the product owner; this ADR does not depend on it.
