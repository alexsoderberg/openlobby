import {
  HERO_MAX_FRAME_SECONDS,
  easeToward,
  pointerToUnit,
  type HeroPointer,
  type HeroScene,
} from "./hero";

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

/** Animates the scene only while the tab is visible and the stage is on screen. Returns the stop function. */
export function startHeroLoop(
  scene: HeroScene,
  stage: HTMLElement,
  hero: HTMLElement,
  env: HeroLoopEnv,
): () => void {
  const target: HeroPointer = { x: 0, y: 0 };
  const current: HeroPointer = { x: 0, y: 0 };
  let frame = 0; // 0 means no frame is scheduled; browsers never return 0 as an id
  let last = 0;
  let elapsed = 0;
  let onScreen = true;

  const tick = (now: number) => {
    const seconds = Math.min(
      (now - last) / MS_PER_SECOND,
      HERO_MAX_FRAME_SECONDS,
    );
    last = now;
    elapsed += seconds;
    current.x = easeToward(current.x, target.x, seconds);
    current.y = easeToward(current.y, target.y, seconds);
    scene.render(elapsed, current);
    frame = env.requestFrame(tick);
  };
  const sync = () => {
    const shouldRun = onScreen && env.document.visibilityState === "visible";
    if (shouldRun && !frame) {
      last = env.now();
      frame = env.requestFrame(tick);
    } else if (!shouldRun && frame) {
      env.cancelFrame(frame);
      frame = 0;
    }
  };
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

  const resizes = new env.ResizeObserver(([entry]) =>
    scene.setSize(entry.contentRect.width, entry.contentRect.height),
  );
  const visibility = new env.IntersectionObserver(([entry]) => {
    onScreen = entry.isIntersecting;
    sync();
  });
  resizes.observe(stage);
  visibility.observe(stage);
  env.document.addEventListener("visibilitychange", sync);
  hero.addEventListener("pointermove", onPointerMove);
  hero.addEventListener("pointerleave", onPointerLeave);
  scene.render(0, current);
  sync();

  return () => {
    env.cancelFrame(frame);
    frame = 0;
    resizes.disconnect();
    visibility.disconnect();
    env.document.removeEventListener("visibilitychange", sync);
    hero.removeEventListener("pointermove", onPointerMove);
    hero.removeEventListener("pointerleave", onPointerLeave);
  };
}
