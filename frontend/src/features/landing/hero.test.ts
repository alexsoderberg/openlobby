import { describe, expect, it, vi } from "vitest";
import { themeForGenre } from "../../genres";
import { formatTime } from "../../i18n";
import { en } from "../../i18n/messages/en";
import {
  HERO_SAMPLE_CARDS,
  HERO_TIMING,
  chooseHeroMode,
  heroCardContent,
} from "./hero";
import { heroFrameAt } from "./heroCycle";

describe("chooseHeroMode", () => {
  it("is static for reduced motion, without checking WebGL", () => {
    const hasWebGL = vi.fn(() => true);
    expect(chooseHeroMode(true, hasWebGL)).toBe("static");
    expect(hasWebGL).not.toHaveBeenCalled();
  });

  it("is static without WebGL", () => {
    expect(chooseHeroMode(false, () => false)).toBe("static");
  });

  it("is a scene otherwise", () => {
    expect(chooseHeroMode(false, () => true)).toBe("scene");
  });
});

describe("the sample cards", () => {
  const contents = HERO_SAMPLE_CARDS.map((card, index) =>
    heroCardContent(en, index, card.startCount),
  );

  it("are in the cycle order of REQ-0013", () => {
    expect(contents.map((card) => card.gameName)).toEqual([
      "Sample shooter",
      "Sample racing",
      "Sample party",
    ]);
    expect(contents.map((card) => card.spotsText)).toEqual([
      en.lobbyPlayers(2, 5),
      en.lobbyPlayers(1, 4),
      en.lobbyPlayers(3, 8),
    ]);
    expect(contents[0].timeText).toBe(formatTime("2030-01-05T19:00:00"));
  });

  it("differ in game name, time, size and genre", () => {
    for (const field of ["timeText", "gameName", "spotsText"] as const)
      expect(new Set(contents.map((card) => card[field])).size).toBe(3);
    expect(new Set(HERO_SAMPLE_CARDS.map((card) => card.maxCount)).size).toBe(
      3,
    );
    expect(new Set(HERO_SAMPLE_CARDS.map((card) => card.genre)).size).toBe(3);
  });

  it("have a different 3D motif each, taken from the genre themes", () => {
    const kinds = HERO_SAMPLE_CARDS.map(
      (card) => themeForGenre(card.genre).motif.kind,
    );

    expect(new Set(kinds).size).toBe(3);
  });

  it("show the players text and the meter step by step with a fake clock", () => {
    const texts = [1, 2, 3, 4].map((second) => {
      const frame = heroFrameAt(second, HERO_SAMPLE_CARDS, HERO_TIMING);
      const content = heroCardContent(en, 0, frame.count);
      return [content.spotsText, content.count / content.maxCount];
    });

    expect(texts).toEqual([
      [en.lobbyPlayers(2, 5), 0.4],
      [en.lobbyPlayers(3, 5), 0.6],
      [en.lobbyPlayers(4, 5), 0.8],
      [en.lobbyPlayers(5, 5), 1],
    ]);
  });
});
