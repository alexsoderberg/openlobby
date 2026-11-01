# 0013. Internationalization of the frontend and error messages
Status: Accepted (2026-11-01)

## Context
The UI ships in English. Swedish will be added later and more languages may follow. Adding a language must not mean editing components across the frontend.

ADR 0001 decides that services return only a machine-readable `code` and a `requestId`, and that the frontend maps codes to texts. CLAUDE.md requires the standard platform first, no dependency without an ADR, and dependencies behind a seam that can be swapped. ADR 0004 and 0006 require that times are shown in each user's local time zone.

Needs:
- Keys are type-checked. A missing or misspelled text is a compile error.
- Plural forms ("1 player", "3 players") and interpolated values.
- A second language is added without touching components.
- The locale can be changed later (user setting).
- Dates, times and numbers use the user's locale and time zone.

User data is not translated: group names, display names from Discord, `gameName` and `customGameName`.

## Decision
1. **Location.** All frontend text and formatting lives in `frontend/src/i18n/`:
   - `messages/en.ts` is the source of keys. It is typed by inference, without `as const`, so that other locales can be checked against it.
   - `messages/<locale>.ts` has one file per additional language, declared with `satisfies Messages`. A missing key is a compile error.
   - `index.ts` is the public surface: `useMessages()`, `formatDateTime()`, `formatTime()`, `toUserMessage()`. Components import only from `src/i18n`.
2. **Hook from day one.** Components read texts through `useMessages()`, not through an imported constant. A later locale switch then changes the hook's implementation (a provider), not the components.
3. **Plurals and interpolation.** Plain texts are strings. Texts with values are functions in the catalog, using template literals. The plural category comes from `Intl.PluralRules` with the locale of the file. No ICU message syntax.
4. **Locale.** At launch the locale is the constant `en`, which is also set as `<html lang>` at startup (WCAG 3.1.1). When a second language exists, the locale is chosen in this order: (1) the user's setting, when it exists (storage needs its own decision, because user data belongs to `auth`), (2) the first entry in `navigator.languages` that is supported, (3) `en`.
5. **Error codes.** The `errors` part of `en.ts` is declared `satisfies Record<ApiErrorCode, string>`, where `ApiErrorCode` is the generated union from `api/`. A new code without text is a compile error. `toUserMessage(code)` returns `errors[code]` when `Object.hasOwn(errors, code)` is true and otherwise the generic text `genericError`. The check protects against prototype keys and against codes the frontend does not know.
6. **Services never return human-readable text.** This confirms ADR 0001. No service or the gateway returns message texts, in any language, and none reads `Accept-Language`. If a response must point to a field, the contract gets an `enum` value for the field, not free text.
7. **Two separate settings.** The *text locale* (the message catalog) is `en` at launch. The *formatting locale* is the browser default: dates, times and numbers use `Intl.DateTimeFormat(undefined, …)` and the browser's time zone (ADR 0006). A Swedish browser therefore shows dates in Swedish while the UI text stays English. Adding Swedish text does not change formatting code. The API keeps RFC 3339 in UTC, and only the frontend converts. All formatting goes through `formatDateTime()` and `formatTime()` in `i18n/`. `Intl.NumberFormat` and `Intl.RelativeTimeFormat` are added to the same module when a requirement needs them.
8. **Agents.** The rule "All user-facing text goes through the message catalog in `frontend/src/i18n/`; no hard-coded UI strings in components" is added to `.claude/agents/ui-ux-expert.md`.

## Consequences
- No new dependency and no adapter. The `i18n/` module is the seam: a library would sit behind `useMessages()` and the formatting functions, so components would not change.
- The catalog is the one authoritative place for texts (DRY). The error texts are checked against the contract at compile time.
- Adding Swedish means one `sv.ts` file with the same keys, and the locale selection. The compiler lists the missing keys.
- Translators edit TypeScript files. That is acceptable at this size.
- The compiler does not catch hard-coded strings. No lint rule for hard-coded JSX strings is added for now (it would be a new dependency). The reviewer checks this manually.
- `Intl` output depends on the browser's ICU data. This is accepted for a small app.

## Alternatives considered
- **(a) No library, typed catalogs and `Intl` (chosen).** Covers all needs above with TypeScript and the platform. Gives up ICU syntax and translation tools (e.g. a web platform where translators work outside the repository).
- **(b) react-i18next.** The most common option. Adds `i18next` and `react-i18next`, needs setup for typed keys, and brings namespaces, backends and lazy loading that this app does not need.
- **(c) FormatJS / react-intl.** ICU MessageFormat with ids. Adds a runtime dependency (`intl-messageformat`) and an extraction step to get typed ids.
- **(d) Lingui.** Good ICU support and typed catalogs. Needs a compile-time macro plugin in the Vite build and an extraction CLI, so the build chain grows.

Revisit (a) if translators must work with ICU or PO files outside the repository, or if a language needs plural rules that are hard to express in code.

## Open questions
None.

Amendment 2026-11-01 (review 2): `ApiErrorCode` is the union of the `code` enums in `api/auth/openapi.yaml` and `api/calendar/openapi.yaml`. In the frontend it is taken from the generated files `frontend/src/api/gen/auth.ts` and `frontend/src/api/gen/calendar.ts` (ADR 0012). The union contains `invalid_request`, `not_found` and `method_not_allowed` as well as the domain codes. Each of them has a text in `errors`. `invalid_request` in a form means that the frontend sent a value it should have validated first, and it is shown as the generic text.
