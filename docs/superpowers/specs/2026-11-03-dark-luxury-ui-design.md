# Dark luxury UI: design

Date: 2026-11-03. Status: approved by the user in chat (brainstorming session). Owner of the build: ui-ux-expert. Reference mockups: `docs/superpowers/specs/2026-11-03-dark-luxury-ui/` (open the HTML files in a browser; they load Google Fonts for preview only).

## Intent and why

The frontend works but looks bare: it was built with neutral default tokens and no visual identity. The user wants OpenLobby to feel **engaging, cool and luxurious**: a dark theme in the spirit of Discord (where its users already are), but more exclusive, with motion that feels designed by a strong UI team. The user also wants a real landing page for logged-out visitors.

Success: opening OpenLobby on a game night feels premium and calm; buttons and scrolling feel smooth and intentional; nothing about the app's behaviour changes.

## Goals

1. A new visual identity applied to every existing screen: landing/login (`start`), my groups, create group, group page (members, invite links), invite page, not-found, and the shared alert/error components.
2. A new landing page for logged-out visitors (replaces today's bare start view for logged-out users).
3. A motion system: entrance, hover, press, scroll reveal and feedback animations, as specified below.
4. Tokens that future screens (game list, lobbies, calendar) inherit without new decisions.

## Non-goals

- No change to functionality, routes, API calls, data or permissions.
- No light theme and no theme switcher (dark only for now).
- No new pages beyond the landing page.
- No animation or UI library, no CSS framework, no CSS-in-JS.

## Anti-goals (a failure even if it technically works)

- **"Whisky club / hotel lobby".** The user rejected: a warm brown-black base, gold borders on every panel, blurred gold glow around buttons, italic serif flourishes everywhere. Gold must be an accent, not an atmosphere.
- Motion that feels slow, bouncy-cartoonish, or that blocks interaction.
- Generic "AI template" look (gradient blobs, emoji icons, stock hero layouts).
- Lower accessibility than today.

## Decided by the user

### Colour ("gold on cool black", mockup `accent-gold-again.html` option 2)

- Background: cool, neutral near-black (reference values: page `#0a0a0d`, top of gradient `#111116`). No brown tone.
- Surfaces: translucent panels, about `rgba(255,255,255,.03)`, with **neutral grey edges** (about `rgba(255,255,255,.08)`), `backdrop-filter: blur(8px)` where supported. Hovered panels may switch their edge to the accent.
- Accent: gold `#f0c75e`, text on accent `#14110a`. Used only on: primary buttons, key numbers (e.g. invite uses "3/10"), the admin badge, the highlighted word in a heading, focus rings, active/selected states, progress meters, the logo's "Lobby".
- A faint accent glow is allowed only as a large, very low-opacity radial wash in the page background (reference: `rgba(240,199,94,.07)`), never around buttons.
- Online/positive indicator: green `#3ddc84` (small dot only).
- Text: near-white body (about `#e9e9ee`), muted grey (about `#8c8d96`).
- The danger colour stays a red with AA contrast on the dark background (builder picks the value).

### Typography (mockup `mix-a-a3.html`)

- **Serif display (Cormorant Garamond, 600–700)** only for the big "luxury moments": the landing page hero headline (and at most the landing section titles).
- **Grotesk (Space Grotesk, 500–700)** for everything in the app: page titles, panel headings, the logo, key numbers. Tight tracking (about `-0.02em` to `-0.03em`) on large sizes.
- **Inter (400–600)** for body text, labels, buttons, inputs.
- Fonts are **self-hosted** woff2 files (OFL licence) served by the frontend container; no request to any third party (ADR 0007: the invite page loads no third-party resources). Use `font-display: swap` and subset to Latin. Include the licence files.

### Shape and detail

- Radii: panels about 14–18px, buttons and inputs about 10px, badges about 6px, avatars round.
- Buttons: primary is solid gold with a subtle inner highlight (inset top light, inset bottom shade), **no outer blur shadow**. Secondary ("ghost") is a translucent dark button with a 1px neutral inset border that turns gold on hover.
- Badges: small, accent text on a faint accent tint.
- Avatars: round, dark gradient placeholder (no image source exists yet).

### Motion (mockup `landing-motion.html`, tempo approved as "lagom")

Easings: `--ease-out: cubic-bezier(.16,1,.3,1)` for movement and fades; `--ease-spring: cubic-bezier(.34,1.56,.64,1)` for button lift.

- Landing hero: headline lines rise from a clipped mask one by one (about 1.1s, 120ms stagger); eyebrow, lead and buttons fade up after it (about 1s, staggered 150ms).
- Primary button hover: lift 2px with the spring easing (about .45s) and a single diagonal light sweep across the button (about .7s). Press: scale to .97 in about .1s. Ghost button hover: lift 2px and gold inset border.
- Top bar: transparent at the top; once scrolled past about 20px it becomes frosted (blurred, translucent, with a bottom hairline).
- Scroll reveal: sections and cards fade up 40px into place when 20% visible (about 1s), cards in a group staggered by 100ms. Each element reveals once.
- Feature cards (landing): lift 6px on hover; a soft accent spotlight follows the pointer inside the card.
- App panels: lift 3–4px and accent edge on hover; list rows get a faint background on hover.
- Meters (e.g. invite uses): fill from 0 to the value when first visible (about 1.6s).
- Feedback: "Copied" and similar confirmations slide/fade in next to the control and out after about 1.8s; they still use the existing persistent `role="status"` live regions.
- Ambient: the page-background accent wash may drift very slowly (about 18s, alternate).
- `prefers-reduced-motion: reduce` disables all of the above (content shown in its final state immediately).
- Motion must never delay or block input; nothing waits for an animation to finish.

### Landing page (new, logged-out only)

Structure from the approved prototype:

1. Top bar: logo + "Log in" (ghost).
2. Hero: small eyebrow chip, serif headline (prototype: "Game night, *planned* properly." with the gold word), one-line lead, primary "Log in with Discord" and secondary "How it works" (scrolls to section 3).
3. "How it works": three steps (gather your group, invite with a link, book the lobby) as feature cards.
4. App preview: a static, decorative preview of a group page (members, invite link with 3/10 meter). It must be clearly decorative (no fake interactivity that looks real, `aria-hidden` or described as an illustration).
5. Footer.

**The copy is not decided.** The prototype text is a placeholder. The product owner decides the final copy (English, in `en.ts`, i18n-ready) and must not promise features that are not built; the lobby step describes upcoming MVP functionality, so the product owner decides whether to show it now or phrase it as coming soon.

Logged-in users keep landing on "my groups" as today.

**Where the landing page shows (orchestrator's call):** only on `/` for a logged-out visitor. It must carry everything today's start view carries there: the login error notice (`?loginError=`), the "session expired" notice, the "logged out" state with focus on the heading, and the existing login link. Protected routes (e.g. `/groups/{id}`, `/invite/{token}`) keep today's `LoginPanel` flow with `returnTo`, restyled in the new look; `LoginPanel` is not deleted. Existing focus and notice tests stay green.

**Highlighted hero word (orchestrator's call):** upright gold, **not italic** (the approved `mix-a-a3.html` hero; italic serif read as "hotel lobby"). Only upright Cormorant weights are self-hosted.

## Constraints (from CLAUDE.md and ADRs)

- Stack: React + TypeScript (Vite), plain CSS. **No new npm dependency.** Fonts are static files, not packages.
- All colour, spacing, radius, type and motion values are **design tokens** in `frontend/src/styles/global.css` (`:root`). Components never hard-code colours or durations. This is what makes a later accent change (e.g. to blue) a few-line edit; the reviewer checks it.
- Accessibility: WCAG AA contrast for all text and UI components (check gold-on-black and black-on-gold, muted text, danger), visible keyboard focus (gold ring), existing ARIA patterns kept (per-link button names, persistent live regions, focus return), and the reduced-motion rule above.
- No third-party requests from any page (fonts, images, scripts). Check the edge/front Nginx config does not need a change for font MIME types; if it does, that is a DevOps request.
- Module rules: shared UI pieces go in `frontend/src/ui/` (exported via its index), hooks in `frontend/src/hooks/`, feature code stays in its feature folder.
- All existing tests stay green; new behaviour (landing page, scroll reveal hook if any) gets tests. Visual details are verified by the reviewer and by screenshots, not by unit tests.
- Skills: `high-end-visual-design` and `design-taste-frontend` (user's choice), plus `ponytail`. Where a skill conflicts with this document or CLAUDE.md, this document and CLAUDE.md win.

## Delivery (small PRs, each reviewed)

1. **Foundation**: dark tokens, fonts (files + `@font-face`), base element styles, buttons, inputs, panels, badges, focus ring, motion tokens and the reduced-motion rule. Existing screens get the new look through the shared styles.
2. **Landing page** (after the product owner has decided the copy).
3. **App screens polish**: my groups, create group, group page (members, invite links incl. meter and copy feedback), invite page, not-found; scroll reveal and hover motion where specified.

The architect confirms beforehand that self-hosted font files under `frontend/` with their licence need no ADR (or writes a short one).

## Left to the builder

- Exact spacing scale, font sizes and responsive breakpoints (mobile must work well; the hero headline uses `clamp`).
- Exact neutral greys, the danger red, and hover tint values, within the contrast rules.
- Icon approach (inline SVG only; no icon font or library).
- How scroll reveal is implemented (e.g. a small `useReveal` hook with IntersectionObserver), as long as it is one shared mechanism.
- Whether to keep a film-grain texture (the prototype had a faint one; optional, must be a local asset or CSS).
