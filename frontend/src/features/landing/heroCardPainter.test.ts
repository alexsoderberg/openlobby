import { describe, expect, it } from "vitest";
import {
  paintHeroCard,
  readCardStyle,
  type CardStyle,
} from "./heroCardPainter";

const STYLE: CardStyle = {
  surface: "#111",
  border: "#222",
  line: "#777",
  text: "#eee",
  muted: "#888",
  headingFont: "sans-serif",
  bodyFont: "serif",
};
const CONTENT = {
  gameName: "Sample shooter",
  timeText: "7:00 PM",
  spotsText: "3/5 players",
  count: 3,
  maxCount: 5,
};

/** A 2D context that records the texts, the colours that were set and the shapes filled or stroked. */
function recordingCanvas() {
  const texts: string[] = [];
  const colours: string[] = [];
  const shapes: string[] = [];
  const noop = () => undefined;
  const target: Record<string, unknown> = {
    fillText: (text: string) => texts.push(text),
    fill: () => shapes.push(`fill ${String(target.fillStyle)}`),
    stroke: () => shapes.push(`stroke ${String(target.strokeStyle)}`),
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
  return { canvas, texts, colours, shapes };
}

describe("paintHeroCard", () => {
  it("draws exactly the texts it is given, a filled square per player and an outline per free spot", () => {
    const { canvas, texts, shapes } = recordingCanvas();

    paintHeroCard(canvas, CONTENT, STYLE);

    expect(texts).toEqual(["7:00 PM", "Sample shooter", "3/5 players"]);
    expect(
      shapes.filter((shape) => shape === `fill ${STYLE.text}`),
    ).toHaveLength(3);
    expect(
      shapes.filter((shape) => shape === `stroke ${STYLE.line}`),
    ).toHaveLength(2);
  });

  it("uses only the palette it is given, with the text colour on the edge only when full", () => {
    const filling = recordingCanvas();
    paintHeroCard(filling.canvas, CONTENT, STYLE);
    const full = recordingCanvas();
    paintHeroCard(full.canvas, { ...CONTENT, count: 5 }, STYLE);

    const palette = Object.values(STYLE);
    for (const { colours } of [filling, full])
      expect(colours.filter((colour) => !palette.includes(colour))).toEqual([]);
    expect(filling.shapes).toContain(`stroke ${STYLE.border}`);
    expect(full.shapes).not.toContain(`stroke ${STYLE.border}`);
    expect(full.shapes).toContain(`stroke ${STYLE.text}`);
  });

  it("does nothing without a 2D context", () => {
    const canvas = { getContext: () => null } as unknown as HTMLCanvasElement;

    expect(() => paintHeroCard(canvas, CONTENT, STYLE)).not.toThrow();
  });
});

describe("readCardStyle", () => {
  it("reads colours and fonts from the custom properties", () => {
    const element = document.createElement("div");
    element.style.setProperty("--color-control-line", " #7a7268 ");
    element.style.setProperty("--font-heading", "Big Shoulders Display");
    document.body.append(element);

    const style = readCardStyle(element);

    expect(style.line).toBe("#7a7268");
    expect(style.headingFont).toBe("Big Shoulders Display");
    element.remove();
  });
});
