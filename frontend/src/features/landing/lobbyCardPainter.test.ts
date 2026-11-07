import { describe, expect, it, vi } from "vitest";
import {
  paintLobbyCard,
  readCardStyle,
  type CardStyle,
} from "./lobbyCardPainter";

const STYLE: CardStyle = {
  surface: "#111",
  border: "#222",
  text: "#eee",
  muted: "#888",
  accent: "#fc0",
  accentTint: "#330",
  headingFont: "sans-serif",
  bodyFont: "serif",
};

describe("paintLobbyCard", () => {
  it("draws exactly the texts it is given", () => {
    const fillText = vi.fn();
    const noop = () => undefined;
    const context = new Proxy(
      { fillText, measureText: () => ({ width: 100 }) },
      { get: (target, name) => Reflect.get(target, name) ?? noop },
    );
    const canvas = {
      width: 640,
      height: 400,
      getContext: () => context,
    } as unknown as HTMLCanvasElement;

    paintLobbyCard(
      canvas,
      {
        gameName: "Board game night",
        timeText: "7:00 PM",
        spotsText: "3/5 players",
        spotsFill: 0.6,
      },
      STYLE,
    );

    expect(fillText.mock.calls.map(([text]) => text)).toEqual([
      "7:00 PM",
      "Board game night",
      "3/5 players",
    ]);
  });

  it("does nothing without a 2D context", () => {
    const canvas = { getContext: () => null } as unknown as HTMLCanvasElement;

    expect(() =>
      paintLobbyCard(
        canvas,
        { gameName: "", timeText: "", spotsText: "", spotsFill: 0 },
        STYLE,
      ),
    ).not.toThrow();
  });
});

describe("readCardStyle", () => {
  it("reads colours and fonts from the custom properties", () => {
    const element = document.createElement("div");
    element.style.setProperty("--color-accent", " #f0c75e ");
    element.style.setProperty("--font-heading", "Space Grotesk");
    document.body.append(element);

    const style = readCardStyle(element);

    expect(style.accent).toBe("#f0c75e");
    expect(style.headingFont).toBe("Space Grotesk");
    element.remove();
  });
});
