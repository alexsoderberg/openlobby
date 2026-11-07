# 0015. Landing 3D hero with three.js, lazy-loaded
Status: Accepted (2026-11-07)
Amended by ADR 0016 (points 2, 4, 5, 6, 7 and 10: genre themes and the fill cycle)

## Context
The logged-out landing page (F-001 presentation, REQ-0013) gets a decorative 3D hero in `frontend/src/features/landing/LandingPage.tsx`. Three sample lobby cards (a generic game name, a start time, "3/5 players") float in 3D, tilt slowly and react to the mouse pointer. The user asked for three.js. Constraints from the user: the three.js code loads only on the landing page, after first paint, login is never blocked, `prefers-reduced-motion` and browsers without WebGL get a static fallback, and the page is hosted on a Raspberry Pi 5 and opened on phones.

CLAUDE.md allows another tool "only if React cannot solve the need, and then with an ADR that justifies why". A new external dependency also needs an ADR.

**Honest weighing.** CSS `perspective` and `transform` on DOM cards, a CSS keyframe float and a small pointer handler that sets CSS variables can produce the described motion with zero dependencies. What CSS does not give is a WebGL scene: lighting, shading and real materials. The user asked for three.js, which is a product choice, and the need "a 3D scene" is the one CSS does not cover. The decision therefore accepts three.js, but keeps it small, lazy and replaceable. CSS 3D stays the documented path if the budget or the phone check fails (see Consequences).

## Decision
1. **Dependency.** Plain `three`, pinned exactly to `0.187.0` (latest on the npm registry on 2026-11-07, no caret), in `dependencies`. `@types/three` pinned exactly to `0.187.0` in `devDependencies`, because the `three` package declares no `types` of its own. No other 3D package: no `@react-three/fiber`, no `@react-three/drei`, no physics or loaders. The implementing change verifies the pin with `npm view three version` and records the version in its handover. The license of three.js is MIT.

2. **Files.** Everything lives in `frontend/src/features/landing/`:
   - `hero.ts` (main chunk, no vendor code): the port `HeroScene`, the type `HeroPointer`, the pure mode rule `chooseHeroMode`, the fit rule shared by the scene and the static cards (`HERO_ROW_WIDTH`, `heroRowScale`), the tilt limit `clampTilt`, and the named constants (`HERO_MAX_PIXEL_RATIO = 1.5`, `HERO_MAX_TILT_RAD`, `HERO_MAX_FRAME_SECONDS = 0.1`, the sample start date).
   - `lobbyCardPainter.ts` (main chunk, no vendor code): paints one sample card onto a 2D canvas from strings it is given.
   - `heroLoop.ts` (main chunk, no vendor code): `startHeroLoop(scene, stage, hero, env)` runs the animation loop, the pointer tracking (mouse only), the visibility pause (tab hidden or hero off screen), the resize and the cleanup. `env` injects `document`, `requestFrame`, `cancelFrame`, `now` and the observer constructors, so the loop is tested without a browser.
   - `LandingHero.tsx` (main chunk, React): chooses the mode, paints the cards, does the dynamic import, creates the scene, starts the loop with `startHeroLoop` and sets `data-live`. It is the only place that loads the scene.
   - `heroScene.ts` (lazy chunk): the only file in the repository that imports `three`. It exports one factory, `createHeroScene(container, cardCanvases, maxPixelRatio): HeroScene`.

3. **Lazy loading.** `LandingHero.tsx` loads the scene with `import("./heroScene")` inside a `useEffect`, and only in mode `scene`. The effect runs after first paint, so the download starts once the landing page is visible. Vite puts `three` into its own chunk. A static import of `heroScene.ts` or of `three` anywhere in `frontend/src` is a `BLOCKER` in review. Login links are plain anchors and never wait for the hero.

4. **Port and adapter.** The port is defined where it is used, in `hero.ts`, and uses only project types:
   ```ts
   export interface HeroScene {
     render(elapsedSeconds: number, pointer: HeroPointer): void;
     setSize(width: number, height: number): void;
     dispose(): void;
   }
   export interface HeroPointer { x: number; y: number } // -1..1, 0 when idle
   ```
   Types from `three` appear only in `heroScene.ts` and never in its exported signature beyond `HeroScene`. Replacing the vendor means writing another module with the same factory and changing the one `import()` line in `LandingHero.tsx`.

5. **Modes** (`chooseHeroMode` in `hero.ts`, a pure function with unit tests):
   - `static` when `prefers-reduced-motion: reduce` matches, or when WebGL is not available. WebGL is checked in `LandingHero.tsx` by creating a throwaway `webgl2` context and releasing it at once.
   - `scene` otherwise.
   The static frame is the same sample cards, painted once onto a 2D canvas, with no animation, no pointer reaction and no loop. It is shown in mode `static`, while the scene loads, and if loading or scene creation fails. In mode `static` the `three` chunk is never requested.

6. **Card content, without duplicated knowledge.**
   - Texts come from i18n (`frontend/src/i18n/`). The sample game name is a new key in the `landing` messages. The spots text uses the existing "x/y players" message that the lobby list already uses. The time uses the existing time formatter from `frontend/src/i18n/format.ts`, applied to a fixed sample start date in `hero.ts`, so the card does not depend on the clock.
   - `lobbyCardPainter.ts` receives already formatted strings (`gameName`, `timeText`, `spotsText`) and does not format them itself.
   - Colors are read once from the existing CSS custom properties with `getComputedStyle`, so the palette is not copied. Layout sizes are named constants in the painter.
   - Painting waits for `document.fonts.ready`, so the canvas text uses the app font.
   - The layout of a canvas card and of a DOM lobby card is code that looks alike, not shared knowledge. It is not extracted (DRY, rule of three).
   - No new glossary term. The sample cards are not lobbies; they are named "hero cards" in code and never use `Lobby`, `lobbyId` or any API type.

7. **Scene lifecycle.** `LandingHero` creates the scene. `startHeroLoop` in `heroLoop.ts` runs the loop and the listeners:
   - `createHeroScene` is called only after the import resolves and only if the component is still mounted (a `cancelled` flag set in the effect cleanup; this also covers React StrictMode's double effect).
   - Pixel ratio is capped: `min(window.devicePixelRatio, HERO_MAX_PIXEL_RATIO)`.
   - The size follows the container through a `ResizeObserver`.
   - The `requestAnimationFrame` loop runs only while `document.visibilityState === "visible"` and the hero intersects the viewport (`IntersectionObserver`). Leaving either state stops the loop; returning restarts it. The frame delta is clamped to `HERO_MAX_FRAME_SECONDS`, so returning to a tab does not make the cards jump.
   - Pointer: `pointermove` on the hero section, only for `pointerType === "mouse"`. Touch and pen do not tilt; the idle float continues. `pointerleave` returns the target to zero. The tilt is damped each frame, never snapped. The total tilt (pointer plus idle sway, both axes combined) is capped at `HERO_MAX_TILT_RAD` by `clampTilt`.
   - On unmount: the cleanup returned by `startHeroLoop` cancels the frame, disconnects the observers and removes the listeners. The scene is then disposed with `scene.dispose()`.
   - `heroScene.ts` `dispose()` calls `renderer.dispose()`, `renderer.forceContextLoss()`, disposes every geometry, material and texture, and removes the canvas from the container.
   - If the import rejects or the factory throws, the static frame stays visible and the error is written once with `console.error` and context. No silent catch.

8. **Accessibility and interaction.** The hero's decorative container is `aria-hidden="true"`. No information is only in the 3D; the headline, lead and buttons stay DOM text. The static frame covers reduced motion. The pointer tilt is the one requested reaction, and it applies only to the hero cards. Section hover styles are not added (see the user preference for no hover on sections).

9. **Budget.**
   - The lazy `three` chunk (`heroScene.ts` with `three`): at most 135 KB gzip, as reported by `vite build` (raised from 100 KB, see Amendment 2026-11-07). The original 100 KB was an estimate for a tree-shaken build with named imports; `three` declares `sideEffects` only for `src/nodes/**`, so tree shaking works.
   - The main chunk added by the landing hero (`hero.ts`, `lobbyCardPainter.ts`, `LandingHero.tsx`): at most 4 KB gzip.
   - Over budget: the implementer stops and returns to the architect. The budget is not raised silently.
   - The implementing change records both sizes in its handover. The entry chunk of the build must not contain `WebGLRenderer`. Checked by hand at review until it is automated (a follow-up, not part of this ADR).

10. **Tests.**
    - `hero.ts`: unit tests for `chooseHeroMode` (reduced motion gives `static`; no WebGL gives `static`; otherwise `scene`) and for `clampTilt` (the total tilt never exceeds `HERO_MAX_TILT_RAD`).
    - `heroLoop.ts`: unit tests in `heroLoop.test.ts` with a fake scene and a fake `env`. They cover the loop, the visibility pause, mouse-only pointer tracking, the resize and the cleanup.
    - `lobbyCardPainter.ts`: unit test with a fake 2D context that records `fillText` calls. It asserts that exactly the given strings are drawn.
    - `LandingHero.tsx`: `vi.mock("./heroScene")`. Tests: mode `static` never calls the factory; mode `scene` calls the factory after mount, not during render; unmount before the import resolves does not call the factory; unmount calls `dispose`.
    - `LandingHeroImport.test.tsx`: a rejected import keeps the static frame and does not throw.
    - `heroScene.ts`: not unit tested, because jsdom has no WebGL. It is kept thin (three calls only). Verified by hand before release: desktop Chrome, Android Chrome, iOS Safari; reduced motion on; WebGL disabled; tab hidden (loop stops in DevTools); hero scrolled out of view (loop stops).
    - `LandingPage.test.tsx` runs in jsdom, so it always gets the static frame. It must keep passing unchanged.

## Consequences
- Three new packages in the dependency list (`three`, `@types/three`), each pinned. Every version bump is a change with the budget check and the manual check above.
- Visitors with WebGL and without reduced motion download the lazy chunk in the background after first paint. Everyone else downloads nothing extra beyond the 4 KB main chunk addition. The Raspberry Pi serves the chunk as a static file; no server change.
- The hero can be removed in one change: delete `heroScene.ts`, `heroLoop.ts`, the two packages and the scene branch in `LandingHero.tsx`. The static frame stays.
- Upgrade path if the budget or the phone check fails: replace `heroScene.ts` with a CSS 3D adapter behind the same `HeroScene` port. That is a new ADR that supersedes point 1 and point 2 of this one.
- No backend, API, service or data change. `docs/services.md` is not affected.

## Alternatives considered
- **CSS 3D only.** Zero dependencies and enough for tilt and float. Not chosen for this requirement, because the requested result is a 3D scene with lighting and materials, which CSS does not render. It remains the fallback path (see Consequences).
- **`@react-three/fiber` and `@react-three/drei`.** A React reconciler and a helper library for three cards. A second abstraction and a larger chunk for no gain. Rejected.
- **three `CSS3DRenderer` (DOM cards in 3D).** Keeps DOM text and no painter. It still ships `three`, has no shading, and buys less for the same bundle cost. Rejected.
- **Canvas 2D only, no three.js.** No depth or lighting, so it is not the requested 3D. Rejected.
- **Load the scene on idle or on the window load event.** Rejected for now. Loading in an effect after mount already runs after first paint, which meets the constraint with less code.
- **Hover tilt on sections.** Rejected. Only the hero cards react, to the pointer, as requested.

## Amendment 2026-11-07
Status of the amendment: Accepted (2026-11-07).

**Measured.** The implementing change built with `vite build`. The lazy chunk `heroScene-*.js` is 131.5 KB gzip (531 kB raw), above the 100 KB estimate in point 9. The main chunk grew by 2.35 KB gzip, within its 4 KB budget. The entry chunk contains no `WebGLRenderer`. The named imports are the ones listed in point 2 and the implementation uses no others.

**Decision.** The lazy `three` chunk budget in point 9 is raised to at most 135 KB gzip, as reported by `vite build`. The main chunk budget (4 KB gzip) is unchanged. The CSS 3D fallback (Consequences) is not taken now.

**Justification.**
- Nearly all of the size is `WebGLRenderer` and its shader library. three.js includes them whatever material or light is used, so the 100 KB estimate was wrong for this renderer. The code in `heroScene.ts` is already limited to the named imports, and no part of it can be removed without dropping three.js.
- The user chose three.js and "lazy-loaded, light" explicitly. CSS 3D would reverse that choice to save about 30 KB on a file that loads only after first paint, only for logged-out visitors with WebGL and without reduced motion, and never blocks login.
- The limit of 135 KB keeps about 3.5 KB of headroom over the measured 131.5 KB. A larger growth, such as a version bump, fails the budget check again and returns to the architect. The budget is not raised silently a second time.
- The budget was a size check, not the phone check. The phone check in point 10 and the manual checks in point 8 are still required before release. If the phone check fails, the CSS 3D path in Consequences remains the documented path.

**Consequences.** Point 9 and REQ-0013 (acceptance criterion on the bundle size) state 135 KB. The three.js version pin and the rest of this ADR are unchanged.

**Alternatives considered.**
- **Switch to the CSS 3D fallback now.** Drops `three` and the 130 KB chunk, and loses the lighting and materials the user asked for. Rejected: it reverses a decided product choice to fix a size estimate, and the cost is paid only by visitors who can use the scene.
- **Keep 100 KB and split or minify further.** No code remains to remove, and `WebGLRenderer` is needed by any three.js scene. Rejected.
