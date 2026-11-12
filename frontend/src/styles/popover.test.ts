import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const stylesheet = readFileSync(
  join(import.meta.dirname, "global.css"),
  "utf8",
);

/** The declarations of the first rule whose selector list contains `selector`. */
function declarationsFor(selector: string): string {
  const rule = new RegExp(String.raw`[^}]*${selector}[^{]*\{([^}]*)\}`).exec(
    stylesheet,
  );
  return rule?.[1] ?? "";
}

describe("Centred popover sharpness", () => {
  // A transform offset is not snapped to pixels, so a translate(-50%) on an odd-sized box blurs the text.
  it("centres the frame with auto margins, not a translate", () => {
    const frame = declarationsFor(
      String.raw`\.create-popover\.create-popover--centered`,
    );
    expect(frame).toMatch(/margin:\s*auto/);
    expect(frame).not.toMatch(/translate|transform|(^|\s)top:|(^|\s)left:/);
  });

  // A permanent layer can stay rasterised at the scale(0.08) start of the open animation.
  it("keeps no permanent will-change on the card", () => {
    expect(declarationsFor(String.raw`\.create-popover__card`)).not.toMatch(
      /^\s*will-change\s*:/m,
    );
  });

  it("still scrolls the centred card on short screens", () => {
    const card = declarationsFor(
      String.raw`\.create-popover--centered \.create-popover__card`,
    );
    expect(card).toMatch(/max-height:/);
    expect(card).toMatch(/overflow-y:\s*auto/);
  });
});
