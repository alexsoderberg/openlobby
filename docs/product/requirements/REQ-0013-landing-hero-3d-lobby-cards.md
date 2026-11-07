# REQ-0013. Landing hero with 3D lobby cards
Status: Decided
Feature: F-001
Priority: Could

Decided by the user (DECISION, user, 2026-11-07): the concept "floating lobby cards" and the weight "lazy-loaded, light" (answer to the question on the landing page's visual). The product owner wrote the criteria. The library and the rendering approach are the architect's (ADR for the three.js dependency).

## Problem
The logged-out landing page at `/` explains the product in words and with two step cards, but it shows no visual of what a lobby looks like. A visitor who does not know the app cannot see the product's core object (a lobby with its game, time and spots) in the first screen. The user wants the hero to feel designed and to show that object, without making the landing page slower or harder to use.

## User story
As a visitor who is not logged in, I want to see a lively, lobby-shaped visual in the hero of the landing page so that I understand what OpenLobby shows, while the page stays fast, usable on my phone, and calm if I prefer reduced motion.

## Acceptance criteria

Scene in the hero:
- Given that I am logged out and open `/`, when the hero has loaded, then three lobby cards float in 3D space in the hero. Each card shows a generic game name, a clock time and a "X/Y players" meter (Spot / max players, `maxPlayers`) (ASSUMPTION: three cards).
- Given that the cards are shown, when I read their values, then they are fixed sample values from the frontend code: placeholder game names that are not real game titles or logos, and no member names or avatars. The scene requests no group, lobby or member data from any API (REQ-0001: a logged-out visitor sees no group or lobby data).
- Given that I point at the hero with a mouse or another fine pointer, when the pointer moves, then the cards tilt slightly toward the pointer, with a tilt of at most 12 degrees (ASSUMPTION), and return smoothly to rest when the pointer leaves.
- Given that I use a touch screen, or the pointer is not over the hero, when the scene runs, then the cards float slowly on their own, with no tilt that depends on touch.
- Given that I click or tap a card, when the card is decorative, then nothing happens: the card is not a link, opens nothing and does not change state.
- Given that the hero is outside the visible area of the page, or the browser tab is hidden, when that is the case, then the 3D animation pauses and resumes when the hero is visible again.
- Given that I scroll the page on a phone or a desktop while the scene runs, when I scroll, then scrolling is not interrupted or delayed by the scene (manual check on one phone and one desktop; target 60 frames per second on a mid-range phone, ASSUMPTION).

Login is never blocked:
- Given that I open `/` logged out, when the page first paints, then the headline, the lead and the "Log in with Discord" button are visible and usable before the 3D code has been downloaded.
- Given that the 3D code is slow to download, or fails to download, when I use the page, then the "Log in with Discord" button works, the "How it works" link works, and no error message or toast is shown because of the scene.
- Given that I open `/` with a login error (`?loginError=`) or an expired session, when the page loads, then the notice and its focus behavior are the same as today, with or without the scene.

Lazy loading and weight:
- Given that the frontend is built, when the bundles are checked, then the main bundle and every bundle used by a logged-in page contain no 3D library code.
- Given that I open `/` logged out with WebGL and without reduced motion, when the page loads, then the 3D code is requested only after the first paint of the hero, and only on this page.
- Given that the 3D code is gzip-compressed, when its size is measured, then it is at most 135 KB, and the main chunk grows by at most 4 KB (DECISION: ADR 0015).
- Given that I open `/` logged out, when the page loads, then the scene adds no request to any backend service (only static files from the frontend).

Fallback (reduced motion, no WebGL):
- Given that reduced motion is on (`prefers-reduced-motion: reduce`), when I open `/` logged out, then the three cards are shown in their resting position, without animation and without pointer tilt, with the same text and layout as the 3D scene, and the 3D code is not downloaded.
- Given that my browser has no WebGL, or WebGL fails to start, when I open `/` logged out, then the same static cards are shown in the same place, with no blank or broken area and no error message.

Accessibility:
- Given that the scene is shown, when assistive technology reads the page, then the scene is hidden from it (`aria-hidden="true"`), and the scene contains no focusable element (no link, button or tab stop).
- Given that I navigate with the keyboard from the top of `/`, when I press Tab, then the focus order is the same as today: the headline is the first heading in reading order, followed by the "Log in with Discord" and "How it works" controls. The scene is skipped.
- Given that I read the visible card text, when I check its contrast, then it meets WCAG AA against the card background, as all text in the app does.
- Given that I use the page on a phone, when I touch or scroll over the hero, then the page scrolls and the touch is not captured by the scene.
- Given that the scene is shown over or behind the hero text, when I click a button that the scene overlaps, then the button receives the click (the scene does not intercept pointer events).

Layout:
- Given that I open `/` logged out, when the scene loads, falls back or fails, then the headline, lead and buttons do not move (no layout shift). The scene's space is reserved from the first paint (measured: the positions of the headline and buttons are identical before and after the scene loads, and the layout shift score is 0 in a web-vitals check).

Mobile first (cross-cutting, REQ-0012):
- Given that I open `/` on a phone 390 px wide, when I see the hero, then the page does not scroll sideways, the "Log in with Discord" button is visible without scrolling, every tap target is at least 44 px, and the cards are smaller than on desktop but still shown.

Other visitors and the logged-in app:
- Given that I am logged in and open `/`, when the page loads, then the dashboard is shown (REQ-0012) and no scene, card or 3D code is loaded.
- Given that I am logged out and open any page other than `/`, when the page loads, then no 3D scene is shown. The login panel on other pages is unchanged.

## Out of scope
- Real lobby, group or member data on the landing page (REQ-0001).
- Real game titles, logos or game colors (F-030 and its trademark decision apply only to the logged-in game list).
- Clickable or interactive cards: joining, opening or changing anything from the scene.
- Scroll-linked animation, parallax across the page, or a scene in other sections of the landing page.
- Device orientation (gyroscope) tilt on phones.
- Sound.
- 3D in the logged-in app, on the login panel of protected pages, or in any group page.
- Changes to the landing copy. The product owner's copy decision of 2026-11-03 stands.
- Choice of library, version, rendering approach and the fallback image technique (architect and UI expert).

## Related features
F-001 (Log in with Discord): the landing page is a presentation of login and has no feature of its own (features.md, F-001). The hero scene adds no behavior, only a visual, so it is a presentation of F-001 and not a new feature. It is not a duplicate of F-004 or F-017: those show lobbies inside the logged-in app, and the scene is decorative and shows no real data.

The landing page already has a decorative group preview below the steps (`LandingPreview`, generic sample data, `aria-hidden`). The scene is a second decorative visual with a similar purpose. This requirement does not change that preview; see the open questions.

## Open questions
- ASSUMPTION: three cards, tilt at most 12 degrees, 60 frames per second target on a mid-range phone. The user may overrule these numbers.
- DECISION FOR THE USER: keep or remove the existing decorative group preview below the steps now that the hero shows lobby cards? The product owner has not changed it.
- DECISION FOR THE USER: the landing copy leaves out the lobby step "until lobbies ship" (copy decision of 2026-11-03). Lobbies have now shipped. Should the copy get a lobby step? This is a copy decision and is not part of this requirement.
- DECISION FOR THE USER: priority. The product owner set `Could` because no core flow depends on the hero. The user may move it up in `backlog.md`.
