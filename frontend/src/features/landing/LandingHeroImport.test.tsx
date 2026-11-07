import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LandingHero } from "./LandingHero";

// A factory that throws makes the dynamic import of the lazy chunk reject.
vi.mock("./heroScene", () => {
  throw new Error("chunk failed to load");
});

afterEach(() => vi.restoreAllMocks());

describe("LandingHero when the scene chunk fails to load", () => {
  it("keeps the static cards, logs once and does not throw", async () => {
    window.matchMedia = (() => ({ matches: false })) as never;
    const paintContext = new Proxy({}, { get: () => () => ({ width: 0 }) });
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(((
      kind: string,
    ) =>
      kind === "2d" ? paintContext : { getExtension: () => null }) as never);
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    const { container } = render(<LandingHero />);
    await vi.waitFor(() => expect(logged).toHaveBeenCalledTimes(1));

    expect((container.firstElementChild as HTMLElement).dataset.live).toBe(
      undefined,
    );
    expect(container.querySelectorAll("canvas")).toHaveLength(3);
  });
});
