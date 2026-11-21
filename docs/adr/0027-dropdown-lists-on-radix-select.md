# 0027. Dropdown lists on Radix Select

Status: Proposed (2026-11-16)
Amended 2026-11-21 by ADR 0028 (REQ-0029, running order redesign): see the Amendment 2026-11-21 section at the end of this file.
Requirement: REQ-0027 (F-045, product owner, Decided). The game-choice logos are REQ-0026 Amendment 2026-11-16, which waits for PR A of this ADR.
Amends ADR 0021 (point A9, the native-select choice is reversed for the look) and ADR 0023 (point 1 table, point 5 and the "Not adopted" list, point 6 rollout, point 7 pins, the z-index rule of point 4). Each amendment is recorded in those files, and the superseded rows there are fixed in place.

## Context

- Six dropdown lists are native `<select>` elements with the `Select` wrapper of `frontend/src/ui/Select.tsx` (chevron only). Sites: `features/lobbies/LobbyGameFields.tsx` (game choice, create lobby), `LobbySettings.tsx` (game choice of an open lobby, mode, activity), `LobbyModeFields.tsx` (mode, activity), `features/games/GameGenreField.tsx` (genre), `features/invites/CreateInviteLinkForm.tsx` (max uses).
- A native option cannot show a game logo (REQ-0026 Amendment 2026-11-16). The user wants all six lists to look like the app (REQ-0027).
- Values in the call sites are strings. The empty string `""` is a real choice ("no game", "no mode", "none" genre, "no activity").
- ADR 0023 kept the native select because a native control gives the phone's own list. The user now wants a custom sheet on phones instead (REQ-0027, DECISION 2026-11-16), so that reason is gone.
- Behaviour that must be right: WAI-ARIA select-only combobox keyboard (arrows, Home, End, Enter, Space, Escape, Tab, type-ahead), focus return, screen reader roles and states, form values, a list above a dialog, the page behind not scrolling on a phone.
- Tests: about twenty tests use `getByRole("combobox")` with `selectOptions` today (`App.test.tsx`, `InviteLinks.test.tsx`, `LobbyDetailPage.test.tsx`, `LobbySettings.test.tsx`, `GamesPage.test.tsx`, `GameStructure.test.tsx`).

## Options considered for the control

A. **Radix Select** (`@radix-ui/react-select`), wrapped in `ui/Select.tsx`.
B. **A select-only combobox on our own Popover.** A button with `role="combobox"` and `aria-activedescendant`, a listbox panel positioned by hand or on a Popper, and our own keyboard code.

Option A is chosen. ADR 0023 rejected hand-building overlay behaviour for the same reason: focus, Escape, outside dismissal, placement and the exit wait are most of the code and tests. The keyboard pattern of a select-only combobox is the same kind of code. Option B would write it again, and its tests would be ours to keep.

## Decision

**1. Control: Radix Select, one package, exact pin.**
- Add `@radix-ui/react-select` **2.4.1** (exact, no caret) to `frontend/package.json` `dependencies`. Its runtime dependencies (popper, portal, presence, collection, dismissable layer, focus scope, remove-scroll, visually hidden and the small utility packages) are already needed by the Dialog, Popover, DropdownMenu and Tooltip of ADR 0023 and are pinned by the lockfile, not by us.
- Bundle: the package is 372 KB unpacked. Its gzip cost was estimated at 6 to 9 KB. PR A measured +30.6 KB gzip JS (see Amendment 2026-11-17, PR A findings), because this is the first `@radix-ui` package and carries the parts the others share.
- The only import of `@radix-ui/*` for this control is in `frontend/src/ui/Select.tsx` (ADR 0023 point 8; the ESLint rule that enforces it is added in PR A).

**2. API of `ui/Select.tsx`: the same file and export name, a new props shape.**

```ts
export type DropdownOption = {
  value: string;        // the saved value; "" is a valid choice (no game, no mode, no genre)
  label: string;        // the text: the name of the game, mode, activity or genre, or the "none" text
  leading?: ReactNode;  // optional visual before the label, e.g. GameLogo; decorative
  disabled?: boolean;   // shown, not choosable: a saved value that is no longer offered
};

export function Select(props: {
  id: string;                       // on the trigger; the label's htmlFor points at it
  value: string;
  onValueChange: (value: string) => void;
  options: DropdownOption[];
  placeholder?: string;             // shown when `value` matches no option; not an option, not choosable
  name?: string;                    // when set, a hidden input carries the saved value to the form
  disabled?: boolean;
  "aria-invalid"?: boolean;         // on the trigger; the error look as the other fields
  "aria-describedby"?: string;
  ref?: Ref<HTMLButtonElement>;     // the trigger: focus for the genre error and the invite autofocus
});
```

- `ui/Select.tsx` is replaced in place. The `<Select>` element with `<option>` children is gone. Each call site passes `options` built from its data (for example `[{ value: "", label: m.lobbyGameNone }, ...games.map(...), { value: OTHER_GAME, label: m.lobbyGameOther }]`). The call-site change is the `options` array and `onValueChange` in place of `onChange(event)`.
- **A value outside the options.** `Select` invents no label. A saved value that the list no longer offers is passed by the caller as one option with `disabled: true` and its saved label. `LobbySettings.tsx` does this today for a removed mode (the disabled option at line 317): it stays as a disabled option. Without such an option, the trigger shows `placeholder` (or nothing).
- **The placeholder.** The disabled "choose" option of `LobbySettings.tsx` (line 187) is not an option. It becomes the `placeholder` prop, shown while `value` is `""` and no option has that value.
- **Empty value.** Radix forbids an empty string as an item value. `Select.tsx` maps `""` to one internal sentinel (`NO_CHOICE = "__none__"`) and back. This is the only place that knows the sentinel. The sentinel can never equal a saved value: every saved game, mode, activity and role ID is a UUID, and the genre and max uses values are fixed words and numbers. Feature code and saved values never see it.
- **Form values.** Radix's own form bubble would write the sentinel into a form, so the wrapper does not pass `name` to Radix. When `name` is set, `Select.tsx` renders `<input type="hidden" name={name} value={value}>` with the real value. The forms keep their current reading of values (`FormData` or state, as today).
- `aria-invalid` is app-level, as it is for the other fields today: the field's error text is shown by the form, not by the browser's constraint validation. There is no `required` prop, because no call site uses it. The trigger carries `aria-invalid`.
- `leading` is rendered inside Radix's `Select.ItemText`. Radix copies `ItemText` into the closed trigger, so a game row and the closed field show the same logo and name, from one render. The option's `textValue` is the `label` only, so type-ahead and the accessible name read the name, not the logo. (ASSUMPTION for the product owner: the closed field shows the logo too. REQ-0027 names only the rows. Remove `leading` from the trigger if the product owner wants the rows only.)
- The mode, activity, genre and max uses lists pass no `leading`.

**3. Keyboard and screen readers: Radix's behaviour, with one fix for Tab.**
- Radix gives the WAI-ARIA select-only pattern: trigger `role="combobox"` with `aria-expanded`, `aria-controls` and `aria-activedescendant`; options `role="option"` with `aria-selected`; arrows, Home, End, Enter, Space, Escape, focus return to the trigger on close; the label is linked by `htmlFor` (the trigger is a button).
- Type-ahead: Radix's type-ahead timeout is 1 second. Typing letters within it moves to the first option whose name starts with them, so "ch" reaches "Chess". Single letters and repeats (the same letter moves to the next option with that letter) work as REQ-0027 asks. Multi-letter type-ahead is accepted (user, 2026-11-16).
- **Tab.** Radix 2.4.1 calls `preventDefault` on Tab in the content's keydown (`index.mjs` line 534), so the browser does not move focus. REQ-0027 says Tab closes the list with no change and moves focus to the next control. `Select.tsx` adds one handler on the content: on Tab (and Shift+Tab) it closes the list with no change and moves focus to the next tabbable element after the trigger (the previous one for Shift+Tab). This is code in `Select.tsx` only. PR A verifies it in a test and in a browser.
- Alt+Down opens the list. Radix's trigger handles it; if PR A finds it does not, it is added in `Select.tsx`.

**4. Bottom sheet on phones: the same content, the box in utilities, one inline override.**
- Phone is a window under 760 px (`47.5rem`, the app's breakpoint) or a touch pointer (`pointer: coarse`). A touch tablet at 800 px therefore gets the sheet on purpose: the sheet is the touch form of the control, not a width rule only.
- **Positioning.** The content uses `position="popper"`, never `item-aligned`: the popper mode writes fewer inline styles. On phones, the wrapper Radix creates (`[data-radix-popper-content-wrapper]` around the content, the only element that gets inline styles) has its inline `transform` and `will-change` overridden by one rule in `global.css`. Without it, a transformed ancestor would be the containing block of the sheet. Those two declarations are the whole inline override (Amendment 2026-11-17, PR A findings). Its other inline values (`top`, `left`, `position`, `min-width`, the available-height variables) are left alone: the sheet is fixed to the bottom by its own classes, and the wrapper is empty because its content is out of flow.
- **The box is in utilities.** The sheet's classes are in `ui/Select.tsx`, using a Tailwind variant `phone:` defined in `global.css` (`@custom-variant phone (@media (width < 47.5rem), (pointer: coarse))`, the same mechanism as `pointer-coarse:` of ADR 0023 point 4). The classes set, with tokens only: `fixed` (produced once it is off the exclusion list, ADR 0023 Amendment 2026-11-16), `inset-x-(--space-0)` and `bottom-(--space-0)` (zero is the token `--space-0`, ADR 0023 Amendment 2026-11-15 a; `inset-x-0` builds nothing, because `--spacing` is not in the build), `w-full`, the top radius (`rounded-t-(--radius-panel)`), the surface, border and shadow tokens, `max-h-(--size-sheet-max)`, `pb-(--sheet-safe-bottom)`, the z-index `z-(--z-dropdown-list)`, and the row height `min-h-(--size-tap)` on the rows (44 px) with `phone:` on each. This follows ADR 0023 Cascade a: the box stays in utilities. The `phone:` variant is a comma-list `@custom-variant`; PR A checks on the compiled CSS that every sheet class sits inside both conditions of the media list.
- **Tokens added in `:root` of `global.css`:** `--z-dropdown-list: 70` (above the tab bar at 60 and the floating "+" at 55, below the toaster); `--size-sheet-max: 70dvh`; `--sheet-safe-bottom: calc(var(--space-2) + env(safe-area-inset-bottom))`. The zIndex test (ADR 0023 point 4) asserts that `--z-dropdown-list` is above both and below 1000.
- **Typography and motion** stay in `global.css` under `[data-slot="select-content"]` and `[data-slot="select-item"]` (ADR 0023 point 2 allows type and motion there). The row text is at least 16 px (the font token that gives 16 px, so no zoom on focus), and the open and close motion is transform and opacity only, under `[data-state]`. Reduced motion shows the final state (the existing block).
- **The one `!important`.** The wrapper override in `global.css` is the only `!important` in this design:

  ```css
  /* Radix writes the wrapper's transform and will-change inline; on phones the sheet must sit on the viewport (ADR 0027 point 4). */
  @media (width < 47.5rem), (pointer: coarse) {
    [data-radix-popper-content-wrapper]:has(> [data-slot="select-content"]) {
      transform: none !important;
      will-change: auto !important;
    }
  }
  ```
  A test (PR A, `styles/selectSheet.test.ts`) reads `global.css` and asserts that `!important` appears only in this block.
- Rejected: a second component for phones (a Drawer library such as vaul). It would be a second dependency and a second look for one control. Rejected: a native `<select>` on phones. The user decided against it on 2026-11-16.
- Rejected: our own listbox for phones only. Two behaviours to test for one control.
- If PR A finds that the sheet does not hold at 390 px or 800 px on a real or emulated touch screen, PR A stops and returns to the architect. It does not fall back silently.

**5. Look.**
- The trigger uses the text-field tokens (height, border, radius, font, colours) and a chevron (`chevronDown` through `Icon`, ADR 0021 A1). The panel uses the surface, border, radius and shadow tokens of the other panels. The selected option shows a check mark (`Icon` name `selected`, a state icon under ADR 0021 A9) and the accent colour. The state is also in `aria-selected`.
- Classes in `ui/` follow ADR 0023 point 2 (no `transition`, no literal values). The Select's CSS (`.select`, `.select__chevron`, the `.group-form select` rules) is removed in PR A.

**6. Stacking and dialogs.**
- The content is a portal in `document.body`, with `z-(--z-dropdown-list)` (70). It sits above an open Popover frame, a dialog and the tab bar, and below the toaster. The sheet covers the tab bar and the "+" by this value (REQ-0027).
- No Select is placed inside a native `<dialog>` (top layer). Today none is. A rule for the reviewer: a Select inside a native dialog or native popover is a BLOCKER until that dialog is a Radix dialog (ADR 0023 PR C).

**7. Tests.**
- `frontend/src/test/setup.ts` gets the jsdom polyfills Radix Select needs: `ResizeObserver` (already planned by ADR 0023), `hasPointerCapture`, `releasePointerCapture` and `scrollIntoView`. One place.
- A helper `frontend/src/test/chooseOption.ts`: `chooseOption(combobox, name)` opens the trigger (pointer down with the mouse type, as Radix expects) and clicks the option by its name. The six test files use it in place of `selectOptions`. The helper is the only place that knows how Radix opens in jsdom.
- `ui/Select.test.tsx` (new): the sentinel round trip (`""` in, `""` out), a disabled saved option, the placeholder, `leading` shown in the trigger and the row, the name as the option's text value, the hidden input value with `name`, keyboard (arrows, Home, End, Enter, Escape, Tab and Shift+Tab with focus to the next control, letter type-ahead), `aria-expanded`, focus return.
- `styles/selectSheet.test.ts` (new): `!important` only in the block of point 4; the sheet's z-index token is above 60 and 55 and below 1000.
- Tests that read the saved values stay as they are; only the way of choosing changes.
- Visual and phone checks (390 px and 800 px, a Select in a dialog-free form and in a popover form) are in PR A's handover with screenshots, by the UI expert.

**8. Rollout (ADR 0023 point 6, amended).** DECISION, user, 2026-11-16: the order is cover PR2 (REQ-0026), then B3 (the rest of the Button call-site migration), then Select (PR A), then Dialog (PR C) and the rest of ADR 0023 in its order. The reason for the place: the Select touches the same six feature files as the Button migration, and two agents must not change one file at once. Select does not need the Dialog, Tooltip, Menu or Popover families, because it is a portal and no Select sits in a native dialog. The game-choice logos (REQ-0026 Amendment 2026-11-16) come after PR A, in PR B2 below.

**Amendment 2026-11-17.** DECISION, user, 2026-11-17: Select (PR A) is built now, before B3, because the dropdowns still look stock and the user wants them first. B3 is not running, so the reason above is kept by building them one after the other: PR A first, then B3. The order is now cover PR2 (REQ-0026), then Select (PR A), then B3, then Dialog (PR C) and the rest of ADR 0023 in its order.

**Amendment 2026-11-17 (PR A findings).** The UI expert built PR A and found the deviations below. Points 1, 2, 4 and Consequences are corrected in place to match; this amendment records why.
- **Point 2 (API).** The invalid prop is `"aria-invalid"`, not `invalid`, so that `fieldProps()` spreads unchanged. `required` is left out, because no call site uses it. `ref` is added: the genre error focus and the invite form's autofocus need the trigger. Radix 2.4.1's `SelectValue` drops `className`, so `Select.tsx` wraps the value in its own span, which carries the classes.
- **Point 4 (wrapper).** Besides `transform`, floating-ui writes `will-change: transform` inline on the wrapper at 1.5 dppx or more. Every phone is at that density (measured at DPR 3). `will-change: transform` makes the wrapper the containing block of the fixed sheet, as a transform does. The `!important` block therefore has two declarations, `transform: none !important; will-change: auto !important;`, verified at DPR 3. The `selectSheet` test checks both.
- **Point 4 (safe area).** `--sheet-safe-bottom` is `calc(var(--space-2) + env(safe-area-inset-bottom))`: the space token plus the inset, not the inset alone.
- **Point 7 (test rules).** `uiClasses.test.ts` and `tokens.test.ts` accept `--radix-*` variables. Radix sets them at run time; they are not tokens and are not in `:root`.
- **Point 7 (focus lookups).** A test or a browser check finds a dropdown list's trigger by `[role="combobox"][id$="-<field>"]`, because `name` is on the hidden input (point 2), not on the trigger.
- **Point 1 and Consequences (bundle).** Vite build, PR A: JS +30.6 KB gzip (113.26 to 143.82 KB), CSS +0.54 KB gzip. The first `@radix-ui` package brings the shared parts (popper, floating-ui, remove-scroll, focus-scope, dismissable-layer). Each later Radix package is measured in its own PR.
- **Point 1 (lint).** The ESLint `no-restricted-imports` rule for `@radix-ui/*` and `sonner` outside `frontend/src/ui/` is added in PR A. It enforces ADR 0023 point 8.

PR slices:

| PR | Content | Owner | Checks |
|---|---|---|---|
| 0 | This ADR, ADR 0021 and 0023 amendments, glossary rows, CLAUDE.md Stack line | architect | reviewer: docs-only, no BLOCKER |
| A | Add `@radix-ui/react-select` 2.4.1. Rewrite `ui/Select.tsx` (point 2, Tab handler point 3, sheet classes point 4). Migrate the six call sites to `options`: `LobbyGameFields.tsx`, `LobbySettings.tsx` (game, mode, activity), `LobbyModeFields.tsx`, `GameGenreField.tsx`, `CreateInviteLinkForm.tsx`. The tokens and the one override of point 4 in `global.css`. Remove the native select rules. `ui/Select.test.tsx`, `styles/selectSheet.test.ts`, `chooseOption` helper, polyfills, migrated tests. No logo in this PR. | ui-ux-expert | keyboard list of point 3 green in tests and in a browser, Tab checked; sheet at 390 px and 800 px with screenshots; no `<select>` outside `ui/`; `uiClasses.test.ts` and zIndex tests green; Vite build numbers in the handover |
| B1 | The Game roles headings on the You page (REQ-0021) show `GameLogo` at `--size-game-logo` before the name. No Select needed, so it may run before or after A | ui-ux-expert | test: each heading has the logo or monogram, name as text; screenshot |
| B2 | Logos in the game choice rows (and in the closed field, see point 2) through `leading`, in `LobbyGameFields.tsx` and the game choice of `LobbySettings.tsx`. "Other" and "no game" get no `leading` | ui-ux-expert | test: a game with a logo shows its image and name; without one, the monogram; "Other" and "no game" show neither; a failed image shows the monogram |

Each PR is reviewed on its own, after its own work. The reviewer checks A and B2 against this ADR.

**Amendment 2026-11-17 (ADR 0024 PR2).** Point 2 gains one optional prop, `reportRepick?: boolean`. With it on, picking the option that is already shown also calls `onValueChange`, because Radix reports only changes. The role icon field uses it, so a pick by hand of the shown icon (including "No icon") stops the name suggestion (ADR 0024 point 4). It is opt-in because other lists act on a change (`onChoose`, `onModeChange`) and must not run again on a repick. Radix stays inside `ui/Select.tsx`.

## Consequences

- One new direct dependency, exact pin. Measured in PR A: +30.6 KB gzip JS and +0.54 KB gzip CSS, far above the 6 to 9 KB estimate (see Amendment 2026-11-17, PR A findings). Later Radix packages share these parts, so they cost less.
- Every dropdown list changes look and keyboard behaviour at once, in PR A. The reviewer checks all six lists, not one.
- One `!important` is allowed (point 4), named and tested. It is the only exception.
- **Dependency on Radix internals.** The phone sheet relies on Radix 2.4.1 writing the popper wrapper with an inline `transform` and on `position="popper"`. A Radix upgrade is a separate PR that re-checks point 4 and the Tab handler (point 3); the `selectSheet` test catches a change in the `!important` block.
- About twenty tests change how they choose an option. The helper keeps the change to one line per test.
- Radix's type-ahead timeout (1 s) and multi-letter matching are accepted (user, 2026-11-16).

## Alternatives considered

- **Select-only combobox on our own Popover (option B).** Its keyboard and focus code would be ours and would need the same tests as Radix's. Rejected for the reason in "Options considered".
- **shadcn Select with the `radix-ui` umbrella.** The umbrella brings about thirty packages (ADR 0023 point 7). Rejected.
- **A Drawer library (vaul) for the phone sheet.** A second dependency and a second look. Rejected.
- **Keep the native `<select>` on phones, custom only on desktop.** The user wants the same look on phones (REQ-0027). Rejected.
- **Put `name` on Radix Select and let its bubble select carry the value.** The bubble would carry the sentinel. Rejected (point 2).
- **Change the empty choice to a real value (e.g. "none") in the saved data.** Changes the API and the stored values. Rejected: REQ-0027 says the saved values are the same.
- **A text field to filter the list.** Out of scope (REQ-0027, DECISION 2026-11-16).

## Amendment 2026-11-21 (ADR 0028, REQ-0029)
- The panel is a white surface with a 2 px ink border, no radius and no shadow (ADR 0028 section 2).
- The trigger border is ink, at least 3:1 on the ground (REQ-0029 item 1).
- Selected option: check mark and 2 px ink edge, no fill. Highlighted option: ink wash and the focus ring, with no orange. This changes REQ-0029 item 9 (orange tint); the user decided ink wash on 2026-11-21 (ADR 0028 section 12, item 2).
- The bottom sheet, its 44 px rows on touch, the z-index order and the behaviour are unchanged.
