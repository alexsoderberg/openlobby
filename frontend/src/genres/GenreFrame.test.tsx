import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GenreFrame } from "./GenreFrame";
import { GENRE_THEMES } from "./genreThemes";

function frameOf(ui: React.ReactElement) {
  return render(ui).container.firstElementChild as HTMLElement;
}

describe("GenreFrame", () => {
  it("sets the accent and pattern of the genre and shows its children", () => {
    const frame = frameOf(<GenreFrame genre="moba">Content</GenreFrame>);

    expect(frame.textContent).toBe("Content");
    expect(frame.style.getPropertyValue("--genre-accent")).toBe(
      `var(${GENRE_THEMES.moba.accentVar})`,
    );
    expect(frame.style.getPropertyValue("--genre-pattern")).toContain(
      GENRE_THEMES.moba.patternUrl,
    );
  });

  it("uses the neutral theme for no genre", () => {
    const frame = frameOf(<GenreFrame genre={null}>x</GenreFrame>);
    expect(frame.getAttribute("data-genre")).toBe("neutral");
  });

  it("hides the decorative art from assistive technology and draws the motif only when asked", () => {
    const plain = frameOf(<GenreFrame genre="party">x</GenreFrame>);
    expect(plain.querySelectorAll("img")).toHaveLength(1);

    const withMotif = frameOf(
      <GenreFrame genre="party" motif>
        x
      </GenreFrame>,
    );
    const images = Array.from(withMotif.querySelectorAll("img"));
    expect(images.map((image) => image.getAttribute("src"))).toEqual([
      GENRE_THEMES.party.iconUrl,
      GENRE_THEMES.party.motifUrl,
    ]);
    for (const image of images) {
      expect(image.getAttribute("alt")).toBe("");
      expect(image.getAttribute("aria-hidden")).toBe("true");
    }
  });
});
