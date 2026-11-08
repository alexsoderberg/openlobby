import {
  HERO_MAX_FRAME_SECONDS,
  type HeroPointer,
  type HeroSampleCard,
  type HeroScene,
} from "./hero";
import {
  heroFrameAt,
  isSameHeroFrame,
  type HeroFrame,
  type HeroTiming,
} from "./heroCycle";
import { easeToward, pointerToUnit } from "./heroPose";

const MS_PER_SECOND = 1000;

/** Browser parts the loop needs, passed in so tests can drive time, visibility and observers. */
export interface HeroLoopEnv {
  document: Document;
  requestFrame(callback: FrameRequestCallback): number;
  cancelFrame(id: number): void;
  now(): number;
  ResizeObserver: typeof ResizeObserver;
  IntersectionObserver: typeof IntersectionObserver;
}

export const browserLoopEnv = (): HeroLoopEnv => ({
  document,
  requestFrame: (callback) => requestAnimationFrame(callback),
  cancelFrame: (id) => cancelAnimationFrame(id),
  now: () => performance.now(),
  ResizeObserver,
  IntersectionObserver,
});

/** Calls `step` with the seconds since the last frame, once per animation frame while running. */
function frameLoop(env: HeroLoopEnv, step: (seconds: number) => void) {
  let frame = 0; // 0 means no frame is scheduled; browsers never return 0 as an id
  let last = 0;
  const tick = (now: number) => {
    const seconds = Math.min(
      (now - last) / MS_PER_SECOND,
      HERO_MAX_FRAME_SECONDS,
    );
    last = now;
    step(seconds);
    frame = env.requestFrame(tick);
  };
  return (run: boolean) => {
    if (run && !frame) {
      last = env.now();
      frame = env.requestFrame(tick);
    } else if (!run && frame) {
      env.cancelFrame(frame);
      frame = 0;
    }
  };
}

/** Moves `target` toward the mouse over `hero` (touch is ignored). Returns the stop function. */
function trackPointer(hero: HTMLElement, target: HeroPointer) {
  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerType !== "mouse") return;
    const box = hero.getBoundingClientRect();
    target.x = pointerToUnit(event.clientX, box.left, box.width);
    target.y = -pointerToUnit(event.clientY, box.top, box.height);
  };
  const onPointerLeave = () => {
    target.x = 0;
    target.y = 0;
  };
  hero.addEventListener("pointermove", onPointerMove);
  hero.addEventListener("pointerleave", onPointerLeave);
  return () => {
    hero.removeEventListener("pointermove", onPointerMove);
    hero.removeEventListener("pointerleave", onPointerLeave);
  };
}

/** Draws the scene at `elapsed`, repainting the cards only when the frame changed. */
function sceneDrawer(
  scene: HeroScene,
  cards: readonly HeroSampleCard[],
  timing: HeroTiming,
) {
  let shown: HeroFrame | undefined;
  return (elapsed: number, pointer: HeroPointer) => {
    const next = heroFrameAt(elapsed, cards, timing);
    if (!isSameHeroFrame(shown, next)) scene.update(next, cards);
    shown = next;
    scene.render(next, elapsed, pointer);
  };
}

/** Keeps the scene sized to the stage and reports when the stage enters or leaves the screen. */
function observeStage(
  env: HeroLoopEnv,
  stage: HTMLElement,
  scene: HeroScene,
  onScreenChange: (isOnScreen: boolean) => void,
) {
  const resizes = new env.ResizeObserver(([entry]) =>
    scene.setSize(entry.contentRect.width, entry.contentRect.height),
  );
  const visibility = new env.IntersectionObserver(([entry]) =>
    onScreenChange(entry.isIntersecting),
  );
  resizes.observe(stage);
  visibility.observe(stage);
  return () => {
    resizes.disconnect();
    visibility.disconnect();
  };
}

/** Animates the scene only while the tab is visible and the stage is on screen. Returns the stop function. */
export function startHeroLoop(
  scene: HeroScene,
  stage: HTMLElement,
  hero: HTMLElement,
  env: HeroLoopEnv,
  cards: readonly HeroSampleCard[],
  timing: HeroTiming,
): () => void {
  const target: HeroPointer = { x: 0, y: 0 };
  const current: HeroPointer = { x: 0, y: 0 };
  // The static frame already shows the first card in place, so the scene starts after its enter phase.
  let elapsed = timing.enterSeconds;
  let onScreen = true;
  const draw = sceneDrawer(scene, cards, timing);
  const setRunning = frameLoop(env, (seconds) => {
    elapsed += seconds;
    current.x = easeToward(current.x, target.x, seconds);
    current.y = easeToward(current.y, target.y, seconds);
    draw(elapsed, current);
  });
  const sync = () =>
    setRunning(onScreen && env.document.visibilityState === "visible");

  const stopObserving = observeStage(env, stage, scene, (isOnScreen) => {
    onScreen = isOnScreen;
    sync();
  });
  env.document.addEventListener("visibilitychange", sync);
  const stopPointer = trackPointer(hero, target);
  draw(elapsed, current);
  sync();

  return () => {
    setRunning(false);
    stopObserving();
    env.document.removeEventListener("visibilitychange", sync);
    stopPointer();
  };
}
