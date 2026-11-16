# REQ-0027. Custom dropdown lists
Status: Decided
Feature: F-045
Priority: Should (product owner's judgment: the change is to look and keyboard behaviour only, and no core flow depends on it; the user wrote "must be improved"). Order decided by the user, 2026-11-16 (see Decisions).
Architecture: ADR 0027 (Radix Select, with the amendments of ADR 0021 and ADR 0023 it requires)

## Problem
Every dropdown list in the app is a native browser select with a chevron added. It looks like the browser's default control, not like the rest of the app. The user said on 2026-11-16: "they feel like a stock dropdown". A native option cannot show an image, so the game choice cannot show game logos (REQ-0026, Amendment 2026-11-16).

The app has six dropdown lists (2026-11-16):
1. Game choice when creating a lobby (REQ-0003, REQ-0009).
2. Game choice in the lobby settings, for an open lobby without a game (REQ-0015).
3. Mode, in the create form and in the lobby settings (REQ-0015).
4. Activity, in the create form and in the lobby settings (REQ-0015).
5. Genre, in the game form (REQ-0014).
6. Max uses, when creating an invite link (REQ-0002).

## User story
As a member and as a system admin, I want every dropdown list to look and behave like the rest of the app, and the game choice to show each game's logo, so that the app feels made for it and I can recognise a game before I choose it.

## Terms
- **Dropdown list**: a control where a person picks one value from a list that opens over the page. Used for the six lists above. Not the date and time inputs and not text fields. Avoid: select box, stock dropdown, combo box. CLAUDE.md has the glossary row (ADR 0027).
- **Game choice**: the dropdown list of games (lists 1 and 2 above).
- **Game logo, monogram**: as in the glossary of CLAUDE.md and REQ-0026. The rules for showing them are in REQ-0026 and are not repeated here.

## What "custom" means here
The look is set by the design tokens of the app and is the same for every dropdown list:
- The closed field has the height, border, radius, font and colours of the app's text fields, and a chevron.
- The open list is a panel with the surface, border, radius and shadow of the app's other panels.
- The selected option has a check mark and the accent colour.
- Opening and closing move only opacity and transform, over the motion duration token (no movement of the layout). With reduced motion on, the list shows with no movement.
- No browser default look is visible.

## Acceptance criteria

Look (all six dropdown lists):
- Given a dropdown list, when it is closed, then it shows its value (or its empty choice text) and a chevron, with the height, border, radius and font of the app's text fields, and no browser default control is shown.
- Given a dropdown list, when it is open, then the list is a panel with the surface, border, radius and shadow of the app's other panels, and its options use the app's spacing and font.
- Given a dropdown list is open, when I look at the selected option, then it has a check mark and the accent colour, and the check mark alone shows that it is selected (WCAG 1.4.1).
- Given a dropdown list opens or closes, when it moves, then only its opacity and transform change, over the motion duration token; with reduced motion on, it shows with no movement.
- Given a dropdown list has more options than fit in the window, when it is open, then it scrolls inside its panel and stays fully inside the window, opening above the field when there is more room there.
- Given a dropdown list is open inside a dialog, when it appears, then it is above the dialog and can be used.
- Given a dropdown list is disabled, when I look at it, then it shows its value, cannot be opened, and uses the disabled look of the app's fields.
- Given a dropdown list has a validation error, when I look at it, then it has the same error look and linked error text as the app's other fields.

Keyboard (all six dropdown lists):
- Given the closed dropdown list has focus, when I press Enter, Space, Down arrow or Alt+Down arrow, then the list opens and focus is on the selected option, or on the first option when none is selected.
- Given the list is open, when I press Down arrow or Up arrow, then focus moves to the next or previous option and stops at the first and the last option; Home and End move to the first and the last option.
- Given an option has focus, when I press Enter or Space, then that option becomes the value, the list closes, and focus returns to the field.
- Given the list is open, when I press Escape, then the list closes with no change and focus returns to the field.
- Given the list is open, when I press Tab, then the list closes with no change and focus moves to the next control.
- Given the list is open, when I type a letter, then focus moves to the next option whose name starts with that letter; typing the same letter again moves to the next such option.
- Given the list is open, when I type several letters quickly, then focus moves to the next option whose name starts with those letters (e.g. "ch" finds "Chess"). The time window is the type-ahead timeout of the chosen control (ADR 0027).
- Given the list is open, then there is no search field to filter it (DECISION, user, 2026-11-16). Typing is the only way to jump in a list.
- Given I use only the keyboard, when I fill any form with a dropdown list, then every option can be reached and chosen.

Screen readers (all six dropdown lists):
- Given a dropdown list, when a screen reader reaches it, then it reads the label, that it is a choice control, its current value, and whether it is open. The markup is the one of ADR 0027 (Radix Select), which follows the WAI-ARIA select-only combobox pattern.
- Given the list is open, when I move through its options, then each option is read with its name, whether it is selected, and its position ("2 of 5").
- Given an option shows a logo or a monogram, when a screen reader reads it, then the image is hidden from it and the game name is read once, as text (REQ-0026).
- Given I choose an option, when the list closes, then the field reads its new value.

Touch and phones (all six dropdown lists):
- Given I use a phone (window under 760 px, or a touch pointer), when I open a dropdown list, then it opens as a full-width sheet from the bottom edge, and each option is at least 44 px high (DECISION, user, 2026-11-16).
- Given the sheet is open on a phone and the list is a game choice, when I look at its rows, then each row shows the game's logo or monogram as REQ-0026 defines, the same as on desktop (DECISION, user, 2026-11-16).
- Given the sheet is open on a phone, when I tap an option, then it becomes the value and the sheet closes; when I tap outside the sheet, then it closes with no change.
- Given the sheet is open on a phone, then the page behind does not scroll, and the sheet covers the tab bar and the floating "+" button.
- Given a phone, when I open a dropdown list, then its text is at least 16 px, so the browser does not zoom in on focus (cross-cutting rule of features.md).

Game choice (lists of game titles):
- Given the game choice is open, when I look at its rows, then the logos, monograms and names follow REQ-0026 (Game choice and game headings), and the closed field shows the chosen game's logo or monogram before its name as the rows do (DECISION, product owner, 2026-11-16; see Decisions).
- Given the game choice is open, when I look at it, then its rows and order are those of REQ-0009 ("most used first", "Other" last). Only the look changes.

What a choice does (unchanged):
- Given I pick a value in any dropdown list, when I save, then the form behaves as before: "Other" shows the free-text name, the mode list shows only the modes of the chosen game, and the saved values are the same. The API is not changed.

## Out of scope
- Date and time inputs, text fields and checkboxes. They keep their own look.
- A text field to search or filter a dropdown list (DECISION, user, 2026-11-16). Revisit later as a new decision when the list is long.
- Multi-select, grouped options, and options with pictures or descriptions other than the game logo and the monogram.
- A combo box that accepts free text. "Other" keeps its own text field, as today (REQ-0009).
- Changing the content or the order of any list (REQ-0009, REQ-0015).
- Logos or monograms in the mode, activity, genre and max uses lists. They are not game titles.
- Logos in lobby lists, the week view and lobby labels (DECISION, user, 2026-11-16: labels stay text-only).
- Per-game colours in lists (F-030 accent colour, F-032 genre themes).

## Related features
- F-030 (game logo and accent colour), REQ-0026: decides where the logos show, including the game choice and the Game roles headings (Amendment 2026-11-16). This requirement gives the game choice its control. Not a duplicate: one is what shows, the other is how a list looks and behaves.
- F-024, F-025, F-003, F-033, F-032, F-002 (game list, game form, lobby form, modes, genre, invite link): their content and rules are unchanged. This requirement changes how the six lists look and are used, once, for all of them (DRY), not in each form.
- No existing feature covers the look of dropdown lists. ADR 0021 and `frontend/src/ui/Select.tsx` keep the native select on purpose (keyboard, screen readers, the phone's own selection). This requirement reverses that choice for the look, and keeps the keyboard, screen reader and phone rules above. Not a duplicate, so F-045 is NEW.

## For the architect
- The control is decided by ADR 0027 (Radix Select). The architect records the amendments of ADR 0021 and ADR 0023 that it needs, and adds the glossary term "Dropdown list" to CLAUDE.md before it is used in code.
- The logo rules of the game choice and the Game roles headings are in REQ-0026 (Amendment 2026-11-16). This requirement does not repeat them.

## Decisions
- DECISION, user, 2026-11-16: dropdown lists must be improved in general and must feel more custom, not like a stock dropdown.
- DECISION, user, 2026-11-16: all six dropdown lists become custom, with one look and one behaviour.
- DECISION, user, 2026-11-16: on phones, a custom full-width sheet from the bottom edge, with 44 px rows and the game logos shown.
- DECISION, user, 2026-11-16: no search field; typing jumps to an option. Revisit when the list is long.
- DECISION, user, 2026-11-16: typing several letters quickly jumps to the next option that starts with them (e.g. "ch" finds "Chess"), as well as a single letter, with the type-ahead timeout of ADR 0027.
- DECISION, user, 2026-11-16: game logos are shown wherever there is a list of game titles: the game choice when creating a lobby, the game choice of an open lobby in the lobby settings, and the game headings under Game roles on the You page (REQ-0026, Amendment 2026-11-16).
- DECISION, user, 2026-11-16: lobby lists, the week view and lobby labels stay text-only.
- DECISION, user, 2026-11-16: order. Cover PR2 of REQ-0026 first, then ADR 0023 PR B3, then this requirement, then the Dialog. Before avatars (REQ-0016).
- DECISION, product owner, 2026-11-16: the closed game choice field shows the chosen game's logo or monogram as well as the rows. It is part of the user's rule that logos show wherever game titles are listed, and it matches the rows. The user may change it.
- DECISION, orchestrator, 2026-11-16: the game logo in the game choice has the size `--size-game-logo` (2.5rem), the same as the game list. The user may change it.
- ASSUMPTION (product owner): the list of six dropdown lists in "Problem" is complete on 2026-11-16. A new dropdown list gets the same look and behaviour by the rule of this requirement.
- ASSUMPTION (product owner): the look is set by the design tokens only (ADR 0023), with no new colour, radius or motion value.
