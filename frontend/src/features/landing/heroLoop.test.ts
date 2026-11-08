import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HERO_SAMPLE_CARDS, HERO_TIMING } from "./hero";
import { startHeroLoop, type HeroLoopEnv } from "./heroLoop";

let frames: Map<number, FrameRequestCallback>;
let nextFrame: number;
let visibility: DocumentVisibilityState;
let intersect: (isIntersecting: boolean) => void;
let resize: (width: number, height: number) => void;
const disconnects = vi.fn();
const cancelFrame = vi.fn((id: number) => frames.delete(id));

class FakeResizeObserver {
  constructor(callback: ResizeObserverCallback) {
    resize = (width, height) =>
      callback(
        [{ contentRect: { width, height } } as ResizeObserverEntry],
        this as unknown as ResizeObserver,
      );
  }
  observe() {}
  disconnect = disconnects;
}

class FakeIntersectionObserver {
  constructor(callback: IntersectionObserverCallback) {
    intersect = (isIntersecting) =>
      callback(
        [{ isIntersecting } as IntersectionObserverEntry],
        this as unknown as IntersectionObserver,
      );
  }
  observe() {}
  disconnect = disconnects;
}

const env = (): HeroLoopEnv => ({
  document: {
    get visibilityState() {
      return visibility;
    },
    addEventListener: (...args: Parameters<Document["addEventListener"]>) =>
      document.addEventListener(...args),
    removeEventListener: (
      ...args: Parameters<Document["removeEventListener"]>
    ) => document.removeEventListener(...args),
  } as Document,
  requestFrame: (callback) => {
    frames.set(++nextFrame, callback);
    return nextFrame;
  },
  cancelFrame,
  now: () => 0,
  ResizeObserver: FakeResizeObserver as unknown as typeof ResizeObserver,
  IntersectionObserver:
    FakeIntersectionObserver as unknown as typeof IntersectionObserver,
});

const scene = {
  update: vi.fn(),
  render: vi.fn(),
  setSize: vi.fn(),
  dispose: vi.fn(),
};
let stage: HTMLElement;
let hero: HTMLElement;

function runFrame(now: number) {
  const [id, callback] = [...frames][0];
  frames.delete(id);
  callback(now);
}

function pointer(type: string, pointerType: string, x = 0, y = 0) {
  hero.dispatchEvent(
    Object.assign(new MouseEvent(type, { clientX: x, clientY: y }), {
      pointerType,
    }),
  );
}

const running: Array<() => void> = [];
const start = () => {
  const stop = startHeroLoop(
    scene,
    stage,
    hero,
    env(),
    HERO_SAMPLE_CARDS,
    HERO_TIMING,
  );
  running.push(stop);
  return stop;
};

const lastPointer = () => scene.render.mock.lastCall![2];

beforeEach(() => {
  frames = new Map();
  nextFrame = 0;
  visibility = "visible";
  vi.clearAllMocks();
  stage = document.createElement("div");
  hero = document.createElement("section");
  hero.append(stage);
  hero.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 200, height: 200 }) as DOMRect;
});

afterEach(() => running.splice(0).forEach((stop) => stop()));

describe("startHeroLoop", () => {
  it("renders once and schedules frames while visible and on screen", () => {
    start();
    expect(scene.render).toHaveBeenCalledTimes(1);
    expect(frames.size).toBe(1);

    runFrame(16);
    expect(scene.render).toHaveBeenCalledTimes(2);
    expect(frames.size).toBe(1);
  });

  it("starts with the first card already in place, as in the static frame", () => {
    start();

    expect(scene.render.mock.calls[0][0]).toMatchObject({
      focusIndex: 0,
      phase: "fill",
      count: HERO_SAMPLE_CARDS[0].startCount,
    });
  });

  it("stops when the tab is hidden and resumes when it is visible again", () => {
    start();

    visibility = "hidden";
    document.dispatchEvent(new Event("visibilitychange"));
    expect(frames.size).toBe(0);

    visibility = "visible";
    document.dispatchEvent(new Event("visibilitychange"));
    expect(frames.size).toBe(1);
  });

  it("stops when the stage leaves the screen and resumes when it returns", () => {
    start();

    intersect(false);
    expect(frames.size).toBe(0);
    intersect(true);
    expect(frames.size).toBe(1);
  });

  it("does not schedule a second frame when asked to resume twice", () => {
    start();
    intersect(true);
    expect(frames.size).toBe(1);
  });

  it("tilts toward a mouse and ignores touch and pen", () => {
    start();

    pointer("pointermove", "touch", 200, 0);
    pointer("pointermove", "pen", 200, 0);
    runFrame(50);
    expect(lastPointer()).toEqual({ x: 0, y: 0 });

    pointer("pointermove", "mouse", 200, 0);
    runFrame(100);
    expect(lastPointer().x).toBeGreaterThan(0);
    expect(lastPointer().y).toBeGreaterThan(0); // top edge tilts up
  });

  it("returns the target to rest on pointerleave", () => {
    start();
    pointer("pointermove", "mouse", 200, 200);
    for (let t = 1; t <= 5; t++) runFrame(t * 100);
    const tilted = lastPointer().x;

    pointer("pointerleave", "mouse");
    for (let t = 6; t <= 30; t++) runFrame(t * 100);

    expect(Math.abs(lastPointer().x)).toBeLessThan(Math.abs(tilted) / 10);
  });

  it("clamps a long pause so the cards do not jump", () => {
    start();
    runFrame(60_000);
    expect(scene.render.mock.lastCall![1]).toBeLessThanOrEqual(
      HERO_TIMING.enterSeconds + 0.1,
    );
  });

  it("repaints only when the frame changes in kind, not on every frame", () => {
    start();
    expect(scene.update).toHaveBeenCalledTimes(1);

    runFrame(100);
    runFrame(200);
    expect(scene.update).toHaveBeenCalledTimes(1); // same count and phase

    for (let t = 3; t <= 12; t++) runFrame(t * 100); // 0.1 s frames reach the first arrival
    expect(scene.update.mock.calls.length).toBeGreaterThan(1);
    expect(scene.update.mock.calls.length).toBeLessThan(
      scene.render.mock.calls.length,
    );
  });

  it("continues from the same point after a pause", () => {
    start();
    for (let t = 1; t <= 5; t++) runFrame(t * 100);
    const before = scene.render.mock.lastCall![1];

    visibility = "hidden";
    document.dispatchEvent(new Event("visibilitychange"));
    visibility = "visible";
    document.dispatchEvent(new Event("visibilitychange"));
    runFrame(600_000);

    expect(scene.render.mock.lastCall![1] - before).toBeCloseTo(0.1);
  });

  it("passes the stage size on to the scene", () => {
    start();
    resize(300, 200);
    expect(scene.setSize).toHaveBeenCalledWith(300, 200);
  });

  it("stop cancels the frame, disconnects the observers and removes the listeners", () => {
    const stop = start();
    stop();

    expect(frames.size).toBe(0);
    expect(disconnects).toHaveBeenCalledTimes(2);
    const renders = scene.render.mock.calls.length;
    pointer("pointermove", "mouse", 200, 0);
    document.dispatchEvent(new Event("visibilitychange"));
    expect(frames.size).toBe(0);
    expect(scene.render).toHaveBeenCalledTimes(renders);
  });
});
