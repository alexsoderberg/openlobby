import { render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LandingHero } from "./LandingHero";
import { startHeroLoop } from "./heroLoop";
import { createHeroScene } from "./heroScene";
import { stubCanvas, stubReducedMotion } from "./heroTestSupport";

vi.mock("./heroScene", () => ({ createHeroScene: vi.fn() }));
vi.mock("./heroLoop", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./heroLoop")>();
  return { ...actual, startHeroLoop: vi.fn(actual.startHeroLoop) };
});

const dispose = vi.fn();
const scene = { update: vi.fn(), render: vi.fn(), setSize: vi.fn(), dispose };

class FakeObserver {
  observe() {}
  disconnect() {}
}

function stubBrowser({ reducedMotion = false, webgl = true } = {}) {
  stubReducedMotion(reducedMotion);
  return stubCanvas({ webgl });
}

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", FakeObserver);
  vi.stubGlobal("IntersectionObserver", FakeObserver);
  vi.mocked(createHeroScene).mockReset().mockReturnValue(scene);
  dispose.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("LandingHero", () => {
  it("renders hidden, decorative cards", () => {
    stubBrowser();
    const { container } = render(<LandingHero />);

    const stage = container.firstElementChild as HTMLElement;
    expect(stage.getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelectorAll("canvas")).toHaveLength(3);
  });

  it("shows the focused card and the one behind it, and hides the third", () => {
    stubBrowser({ reducedMotion: true });
    const { container } = render(<LandingHero />);

    const [front, behind, spare] = Array.from(
      container.querySelectorAll("canvas"),
    );
    expect(front.hidden).toBe(false);
    expect(behind.hidden).toBe(false);
    expect(spare.hidden).toBe(true);
    expect(front.style.transform).not.toBe(behind.style.transform);
  });

  it("paints a static frame whose two visible cards differ in name, time, count and genre", async () => {
    const painted = stubBrowser({ reducedMotion: true });
    const { container } = render(<LandingHero />);
    const [front, behind] = Array.from(container.querySelectorAll("canvas"));
    await waitFor(() => expect(painted.get(behind)?.texts).toHaveLength(3));

    const [time, name, count] = painted.get(front)!.texts;
    const [otherTime, otherName, otherCount] = painted.get(behind)!.texts;
    expect(name).toBe("Sample shooter");
    expect(otherName).toBe("Sample racing");
    expect(time).not.toBe(otherTime);
    expect(count).not.toBe(otherCount);
    expect(painted.get(front)!.images).not.toEqual(painted.get(behind)!.images);
  });

  it("shows the static frame again and frees the scene when WebGL is lost", async () => {
    stubBrowser();
    const { container } = render(<LandingHero />);
    const stage = container.firstElementChild as HTMLElement;
    await waitFor(() => expect(stage.dataset.live).toBe(""));

    container
      .querySelector("canvas")!
      .dispatchEvent(new Event("webglcontextlost"));

    expect(stage.dataset.live).toBeUndefined();
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(container.querySelectorAll("canvas")).toHaveLength(3);
  });

  it("hands the scene one card per genre with its 3D motif from the theme", async () => {
    stubBrowser();
    render(<LandingHero />);
    await waitFor(() => expect(createHeroScene).toHaveBeenCalledTimes(1));

    const cards = vi.mocked(createHeroScene).mock.calls[0][1];
    expect(cards.map((card) => card.motif.kind)).toEqual([
      "reticle",
      "chevrons",
      "confetti",
    ]);
  });

  it("never creates the scene or a WebGL context for reduced motion, and starts no timer or frame", async () => {
    vi.useFakeTimers({
      toFake: ["setTimeout", "setInterval", "requestAnimationFrame"],
    });
    const frame = vi.spyOn(window, "requestAnimationFrame");
    stubBrowser({ reducedMotion: true });
    render(<LandingHero />);
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(0);

    expect(vi.getTimerCount()).toBe(0);
    expect(frame).not.toHaveBeenCalled();
    vi.useRealTimers();

    expect(createHeroScene).not.toHaveBeenCalled();
    expect(HTMLCanvasElement.prototype.getContext).not.toHaveBeenCalledWith(
      "webgl2",
    );
  });

  it("never creates the scene without WebGL", async () => {
    stubBrowser({ webgl: false });
    render(<LandingHero />);
    await new Promise((resolve) => setTimeout(resolve));

    expect(createHeroScene).not.toHaveBeenCalled();
  });

  it("creates the scene after mount and disposes it on unmount", async () => {
    stubBrowser();
    const { unmount, container } = render(<LandingHero />);
    expect(createHeroScene).not.toHaveBeenCalled();

    await waitFor(() => expect(createHeroScene).toHaveBeenCalledTimes(1));
    expect((container.firstElementChild as HTMLElement).dataset.live).toBe("");
    unmount();

    await waitFor(() => expect(dispose).toHaveBeenCalledTimes(1));
  });

  it("does not create the scene when unmounted before it loads", async () => {
    stubBrowser();
    render(<LandingHero />).unmount();
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(createHeroScene).not.toHaveBeenCalled();
  });

  it("keeps the static cards and logs once when the scene fails", async () => {
    stubBrowser();
    vi.mocked(createHeroScene).mockImplementation(() => {
      throw new Error("no context");
    });
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const { container } = render(<LandingHero />);

    await waitFor(() => expect(logged).toHaveBeenCalledTimes(1));
    expect((container.firstElementChild as HTMLElement).dataset.live).toBe(
      undefined,
    );
  });

  it("disposes the scene and keeps the static cards when the loop fails to start", async () => {
    stubBrowser();
    vi.mocked(startHeroLoop).mockImplementationOnce(() => {
      throw new Error("no observer");
    });
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const { container } = render(<LandingHero />);

    await waitFor(() => expect(logged).toHaveBeenCalledTimes(1));
    expect(dispose).toHaveBeenCalledTimes(1);
    expect((container.firstElementChild as HTMLElement).dataset.live).toBe(
      undefined,
    );
  });
});
