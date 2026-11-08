import type { Genre, MotifDescriptor } from "../../genres";
import { formatTime, type Messages } from "../../i18n";
import type { HeroFrame, HeroTiming } from "./heroCycle";
import type { CardContent } from "./heroCardPainter";

/** What the landing hero needs from a 3D scene. The adapter (heroScene.ts) hides the 3D library. */
export interface HeroScene {
  /** Repaints the cards whose player count changed. Called only when the frame changes in kind. */
  update(frame: HeroFrame, cards: readonly HeroSampleCard[]): void;
  render(frame: HeroFrame, elapsedSeconds: number, pointer: HeroPointer): void;
  setSize(width: number, height: number): void;
  dispose(): void;
}

/** Pointer position over the hero, -1..1 on each axis, 0 when idle. */
export interface HeroPointer {
  x: number;
  y: number;
}

/** One sample card as the scene gets it: the canvas it shows, its motif and accent, and how to repaint it. */
export interface HeroSceneCard {
  canvas: HTMLCanvasElement;
  motif: MotifDescriptor;
  accent: string;
  paint(count: number): void;
}

export type HeroMode = "static" | "scene";

export const HERO_MAX_PIXEL_RATIO = 1.5;
/** A long pause (hidden tab) must not make the cards jump. */
export const HERO_MAX_FRAME_SECONDS = 0.1;

export const HERO_TIMING: HeroTiming = {
  enterSeconds: 1,
  stepSeconds: 1,
  glowSeconds: 1.5,
  leaveSeconds: 1,
};

export interface HeroSampleCard {
  gameName: string;
  genre: Genre;
  startCount: number;
  maxCount: number;
  startTime: string;
}

// Fixed sample values, in cycle order: the hero shows no real lobby, game or member (REQ-0001).
// The names are placeholders, never real titles and never translated (ADR 0016 amendment 2026-11-08).
export const HERO_SAMPLE_CARDS = [
  {
    gameName: "Sample shooter",
    genre: "shooter",
    startCount: 2,
    maxCount: 5,
    startTime: "2030-01-05T19:00:00",
  },
  {
    gameName: "Sample racing",
    genre: "racing",
    startCount: 1,
    maxCount: 4,
    startTime: "2030-01-05T20:30:00",
  },
  {
    gameName: "Sample party",
    genre: "party",
    startCount: 3,
    maxCount: 8,
    startTime: "2030-01-05T18:00:00",
  },
] as const satisfies readonly HeroSampleCard[];

/** The texts and numbers of one card with this many players. */
export function heroCardContent(
  m: Messages,
  index: number,
  count: number,
): CardContent {
  const { gameName, maxCount, startTime } = HERO_SAMPLE_CARDS[index];
  return {
    gameName,
    timeText: formatTime(startTime),
    spotsText: m.lobbyPlayers(count, maxCount),
    count,
    maxCount,
  };
}

/** Checks WebGL only without reduced motion, so a reduced-motion visit never creates a WebGL context. */
export function chooseHeroMode(
  reducedMotion: boolean,
  hasWebGL: () => boolean,
): HeroMode {
  return reducedMotion || !hasWebGL() ? "static" : "scene";
}
