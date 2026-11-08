import { describe, expect, it } from "vitest";
import {
  paintHeroCard,
  readCardStyle,
  readCssValue,
  type CardStyle,
  type CardTheme,
} from "./heroCardPainter";

const STYLE: CardStyle = {
  surface: "#111",
  border: "#222",
  text: "#eee",
  muted: "#888",
  glow: "#0f0",
  headingFont: "sans-serif",
  bodyFont: "serif",
};
const THEME: CardTheme = { accent: "#f00" };
const CONTENT = {
  gameName: "Sample shooter",
  timeText: "7:00 PM",
  spotsText: "3/5 players",
  count: 3,
  maxCount: 5,
};

/** A 2D context that records the texts, the colours that were set and the dots drawn. */
function recordingCanvas() {
  const texts: string[] = [];
  const colours: string[] = [];
  const arcs: unknown[] = [];
  const noop = () => undefined;
  const target: Record<string, unknown> = {
    fillText: (text: string) => texts.push(text),
    measureText: () => ({ width: 100 }),
    createPattern: () => null,
    arc: (...args: unknown[]) => arcs.push(args),
  };
  const context = new Proxy(target, {
    get: (object, name: string) => object[name] ?? noop,
    set: (object, name: string, value) => {
      if (name === "fillStyle" || name === "strokeStyle") colours.push(value);
      object[name] = value;
      return true;
    },
  });
  const canvas = {
    width: 640,
    height: 400,
    getContext: () => context,
  } as unknown as HTMLCanvasElement;
  return { canvas, texts, colours, arcs };
}

describe("paintHeroCard", () => {
  it("draws exactly the texts it is given and one dot per spot", () => {
    const { canvas, texts, arcs } = recordingCanvas();

    paintHeroCard(canvas, CONTENT, STYLE, THEME);

    expect(texts).toEqual(["7:00 PM", "Sample shooter", "3/5 players"]);
    expect(arcs).toHaveLength(CONTENT.maxCount);
  });

  it("uses the genre accent while filling and the glow colour only when full", () => {
    const filling = recordingCanvas();
    paintHeroCard(filling.canvas, CONTENT, STYLE, THEME);
    const full = recordingCanvas();
    paintHeroCard(full.canvas, { ...CONTENT, count: 5 }, STYLE, THEME);

    expect(filling.colours).toContain(THEME.accent);
    expect(filling.colours).not.toContain(STYLE.glow);
    expect(full.colours).toContain(STYLE.glow);
  });

  it("does nothing without a 2D context", () => {
    const canvas = { getContext: () => null } as unknown as HTMLCanvasElement;

    expect(() => paintHeroCard(canvas, CONTENT, STYLE, THEME)).not.toThrow();
  });
});

describe("readCardStyle", () => {
  it("reads colours and fonts from the custom properties", () => {
    const element = document.createElement("div");
    element.style.setProperty("--color-accent", " #f0c75e ");
    element.style.setProperty("--font-heading", "Space Grotesk");
    document.body.append(element);

    const style = readCardStyle(element);

    expect(readCssValue(element, "--color-accent")).toBe("#f0c75e");
    expect(style.headingFont).toBe("Space Grotesk");
    element.remove();
  });
});
