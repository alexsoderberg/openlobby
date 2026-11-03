# Dark Luxury UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. In this repository the orchestrator runs it: each task goes to the `ui-ux-expert` agent and then to the `reviewer` agent (CLAUDE.md workflow), one PR per task.

**Goal:** Give the OpenLobby frontend the approved "gold on cool black" dark luxury look, a landing page for logged-out visitors, and a shared motion system, without changing behaviour.

**Architecture:** All visual values live as tokens in `frontend/src/styles/global.css`; components use classes and tokens only. Fonts are self-hosted static files under `frontend/public/fonts/`. Scroll reveal is one shared hook in `frontend/src/hooks/`. The landing page is a new feature module `frontend/src/features/landing/` rendered by the existing `start` route when logged out.

**Tech Stack:** React + TypeScript (Vite), plain CSS, vitest + testing-library. No new npm dependencies.

**Spec:** `docs/superpowers/specs/2026-11-03-dark-luxury-ui-design.md` (reference mockups in `docs/superpowers/specs/2026-11-03-dark-luxury-ui/`).

## Global Constraints

- No new npm dependency; no animation, icon, CSS framework or CSS-in-JS library.
- Every colour, radius, spacing, font and motion value is a token in `:root` of `frontend/src/styles/global.css`; no hard-coded colour or duration in components or other CSS rules.
- Accent `#f0c75e`, text on accent `#14110a`, online green `#3ddc84`; background cool neutral near-black (`#0a0a0d` / `#111116`), panel fill about `rgba(255,255,255,.03)`, panel edge about `rgba(255,255,255,.08)`.
- No outer blur shadow on buttons; gold only as accent (buttons, key numbers, admin badge, highlighted word, focus ring, active state, meters, logo "Lobby").
- Fonts: Cormorant Garamond 600/700 upright (landing hero and landing section titles only), Space Grotesk 500/600/700 (app headings, logo, key numbers), Inter 400/500/600 (body). Self-hosted woff2, Latin subset, `font-display: swap`, OFL licence files committed alongside.
- Easings `--ease-out: cubic-bezier(.16,1,.3,1)`, `--ease-spring: cubic-bezier(.34,1.56,.64,1)`; all motion off under `prefers-reduced-motion: reduce`; motion never blocks input.
- No request to any third party from any page.
- WCAG AA contrast for text and UI components; visible gold focus ring; existing ARIA patterns (per-link button names, persistent `role="status"` regions, focus return) unchanged.
- All existing tests stay green; `npm run lint`, `npm test`, `npm run build` pass.
- Skills: `high-end-visual-design`, `design-taste-frontend`, `ponytail`. CLAUDE.md and the spec win over a skill.

## Review Focus

1. **Contrast of muted text and of the danger colour on the dark background** — a person with low vision must still read hints, timestamps and error messages. Pinned in Task 1 by a token contrast test.
2. **Reduced motion** — with "reduce motion" on, revealed content must be visible immediately (not stuck at opacity 0). Pinned in Task 1 (`useReveal`) and Task 3.
3. **Logged-out notices on the landing page** — a login error, an expired session or a fresh logout on `/` must still show its notice and move focus as today. Pinned in Task 2.
4. **Keyboard-only use of the landing page** — "How it works" must move focus to the section, not only scroll. Pinned in Task 2.
5. **Font loading failure or slow network** — text must render in the fallback stack (no invisible text). Pinned in Task 1 by checking `font-display: swap` and fallback stacks in the tokens.

---

### Task 1: Foundation — tokens, fonts, base components, reveal hook (PR 1)

**Files:**
- Modify: `frontend/src/styles/global.css` (replace light tokens with the dark token set; base element, button, input, panel, badge, focus, motion and reduced-motion styles)
- Create: `frontend/public/fonts/` (woff2 files + `OFL-*.txt` licence files), `@font-face` rules at the top of `global.css`
- Create: `frontend/src/hooks/useReveal.ts`, `frontend/src/hooks/useReveal.test.tsx`; export from `frontend/src/hooks/index.ts`
- Create: `frontend/src/styles/tokens.test.ts`

**Interfaces:**
- Produces tokens (names fixed, later tasks use them): `--color-bg`, `--color-bg-raised`, `--color-surface`, `--color-border`, `--color-text`, `--color-muted`, `--color-accent`, `--color-on-accent`, `--color-accent-tint`, `--color-online`, `--color-danger`, `--color-danger-bg`, `--color-focus` (= accent), `--font-display` (Cormorant stack), `--font-heading` (Space Grotesk stack), `--font-sans` (Inter stack), `--radius-panel`, `--radius-control`, `--radius-badge`, `--ease-out`, `--ease-spring`, `--duration-fast` (.1s), `--duration-base` (.45s), `--duration-slow` (1s), existing `--space-*`.
- Produces classes: `.button` (primary gold), `.button-ghost`, `.panel`, `.badge`, `.eyebrow`, `[data-reveal="pending"]` / `[data-reveal="shown"]`.
- Produces `useReveal<T extends Element>(): React.RefCallback<T>` — sets `data-reveal="pending"` on the element and switches it to `data-reveal="shown"` once when 20% visible (IntersectionObserver, threshold 0.2, unobserve after; state is an attribute, not a class, so React re-renders cannot hide revealed content; `data-reveal` without a value is never hidden); sets `shown` immediately when `matchMedia('(prefers-reduced-motion: reduce)').matches` or when IntersectionObserver is unavailable.

- [ ] **Step 1: Write failing tests**
  - `tokens.test.ts`: parse `:root` of `global.css` (read the file with `node:fs`), and assert WCAG contrast ≥ 4.5 for `--color-text`, `--color-muted`, `--color-danger` on `--color-bg`, and for `--color-on-accent` on `--color-accent`; ≥ 3 for `--color-accent` on `--color-bg`. Assert every `@font-face` has `font-display: swap` and that `--font-display`, `--font-heading`, `--font-sans` each end in a generic family (`serif` / `sans-serif`).
  - `useReveal.test.tsx`: `shows the element when it intersects`, `stays shown when React re-renders it with another className`, `disconnects the observer on unmount`, `reveals immediately when reduced motion is preferred`, `reveals immediately without IntersectionObserver`, `stops observing after the first reveal`.
- [ ] **Step 2: Run** `npm test -- tokens useReveal` — expect FAIL.
- [ ] **Step 3: Implement** tokens, fonts and `useReveal` per the Interfaces block; restyle base elements so every existing screen picks up the dark look; button hover lift 2px with `--ease-spring` + one light sweep, press `scale(.97)` in `--duration-fast`; ghost border turns accent on hover; panels lift 3–4px on hover; frosted sticky top bar class `.topbar.is-scrolled`.
- [ ] **Step 4: Run** `npm run lint && npm test && npm run build` — expect all green (existing 126 tests + new).
- [ ] **Step 5: Hand over** for review; PR "Add dark luxury design tokens, fonts and base styles to the frontend".

### Task 2: Landing page (PR 2, after the product owner has fixed the copy)

**Files:**
- Create: `frontend/src/features/landing/LandingPage.tsx`, `LandingPage.test.tsx`, `index.ts`
- Modify: `frontend/src/app/Pages.tsx` (logged-out `start` renders `LandingPage`), `frontend/src/i18n/messages/en.ts` (copy from the product owner), `frontend/src/styles/global.css` (landing section styles, using Task 1 tokens only)

**Interfaces:**
- Consumes: Task 1 tokens/classes and `useReveal`; the existing login link and notice logic used by `LoginPanel` (`readLoginError`, expired/logged-out state from the session) — reuse, do not duplicate.
- Produces: `LandingPage(props: { notice: <same notice type LoginPanel receives today> }): JSX.Element` exported from `features/landing`.

- [ ] **Step 1: Write failing tests** in `LandingPage.test.tsx`: `shows the hero heading and a Log in with Discord link to the existing login URL`, `shows the login error notice for ?loginError=`, `shows the session expired notice`, `moves focus to the heading after logout` (same assertions as today's LoginPanel tests), `How it works moves focus to the steps section`, `the app preview is hidden from assistive technology`, `loads no third-party resource` (no `src`/`href` outside the origin).
- [ ] **Step 2: Run** `npm test -- LandingPage` — expect FAIL.
- [ ] **Step 3: Implement** structure per spec: top bar, hero (eyebrow chip, serif headline with upright gold word, lead, primary + ghost buttons), three step cards with pointer-follow spotlight (CSS variables set on `pointermove`), decorative preview (`aria-hidden="true"`), footer; hero line-rise and staggered fade-ups; cards revealed with `useReveal`, 100ms stagger. Protected routes keep `LoginPanel` (restyled by Task 1).
- [ ] **Step 4: Run** `npm run lint && npm test && npm run build` — expect green, existing login and App tests unchanged.
- [ ] **Step 5: Hand over** for review; PR "Add the landing page to the frontend".

### Task 3: App screens polish (PR 3)

**Files:**
- Modify: `frontend/src/features/groups/*` (my groups, create group, group page layout: breadcrumb, title, chips, member rows with round avatars and admin badge), `frontend/src/features/invites/InviteLinkList.tsx` + `InviteLinks.tsx` (uses in `--font-heading` gold, meter element, copy feedback motion), `frontend/src/features/invites/InvitePage.tsx`, not-found view in `frontend/src/app/Pages.tsx`, `frontend/src/styles/global.css`
- Test: extend `frontend/src/features/invites/InviteLinks.test.tsx`

**Interfaces:**
- Consumes: Task 1 tokens/classes and `useReveal`.
- Produces: `.meter` with `--meter-value` (0–1) CSS variable; fills from 0 when revealed.

- [ ] **Step 1: Write failing tests**: `the invite uses meter exposes the value as a meter` (`role="meter"` or `<meter>` with `value`/`max` matching uses, accessible name includes "uses"), `copy confirmation still lands in the persistent status region`.
- [ ] **Step 2: Run** `npm test -- InviteLinks` — expect FAIL.
- [ ] **Step 3: Implement** the screen polish per spec (panels lift and accent edge on hover, row hover tint, meter fill ~1.6s, "Copied" slide/fade ~1.8s, reveal on scroll for panel groups), keeping all ARIA names and focus behaviour.
- [ ] **Step 4: Run** `npm run lint && npm test && npm run build` — expect green.
- [ ] **Step 5: Hand over** for review with before/after screenshots of each screen (desktop and 375px wide); PR "Polish the app screens in the dark luxury style".
