import { render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LandingHero } from "./LandingHero";
import { startHeroLoop } from "./heroLoop";
import { createHeroScene } from "./heroScene";

vi.mock("./heroScene", () => ({ createHeroScene: vi.fn() }));
vi.mock("./heroLoop", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./heroLoop")>();
  return { ...actual, startHeroLoop: vi.fn(actual.startHeroLoop) };
});

const dispose = vi.fn();
const scene = { render: vi.fn(), setSize: vi.fn(), dispose };

class FakeObserver {
  observe() {}
  disconnect() {}
}

function stubBrowser({ reducedMotion = false, webgl = true } = {}) {
  window.matchMedia = ((query: string) => ({
    matches: reducedMotion,
    media: query,
  })) as typeof window.matchMedia;
  const paintContext = new Proxy({}, { get: () => () => ({ width: 0 }) });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(((
    kind: string,
  ) =>
    kind === "2d"
      ? paintContext
      : webgl
        ? { getExtension: () => null }
        : null) as never);
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

  it("never creates the scene or a WebGL context for reduced motion", async () => {
    stubBrowser({ reducedMotion: true });
    render(<LandingHero />);
    await new Promise((resolve) => setTimeout(resolve));

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
