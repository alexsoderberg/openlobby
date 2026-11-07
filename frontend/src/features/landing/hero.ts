import { formatTime, type Messages } from "../../i18n";
import type { CardContent } from "./lobbyCardPainter";

/** What the landing hero needs from a 3D scene. The adapter (heroScene.ts) hides the 3D library. */
export interface HeroScene {
  render(elapsedSeconds: number, pointer: HeroPointer): void;
  setSize(width: number, height: number): void;
  dispose(): void;
}

/** Pointer position over the hero, -1..1 on each axis, 0 when idle. */
export interface HeroPointer {
  x: number;
  y: number;
}

export type HeroMode = "static" | "scene";

export const HERO_MAX_PIXEL_RATIO = 1.5;
/** 12 degrees, the tilt limit in REQ-0013. */
export const HERO_MAX_TILT_RAD = (12 * Math.PI) / 180;
/** A long pause (hidden tab) must not make the cards jump. */
export const HERO_MAX_FRAME_SECONDS = 0.1;
/** Higher is snappier: the share of the remaining tilt closed per second. */
const HERO_TILT_RESPONSE = 6;

/** Visible scene height in world units. The stage CSS and the scene share these units. */
export const HERO_VIEW_HEIGHT = 3.6;
export const HERO_CARD_WIDTH = 2.4;
export const HERO_CARD_HEIGHT = 1.5;
/** Resting place of each card: x and y in world units, depth z, roll in radians. */
export const HERO_CARD_LAYOUT = [
  { x: -2, y: -0.15, z: 0, roll: 0.07 },
  { x: 0, y: 0.2, z: 0.5, roll: 0 },
  { x: 2, y: -0.15, z: 0, roll: -0.07 },
] as const;
/** Width of the row of cards in world units. A narrower view scales the row down to fit. */
export const HERO_ROW_WIDTH =
  2 * Math.max(...HERO_CARD_LAYOUT.map((card) => Math.abs(card.x))) +
  HERO_CARD_WIDTH;

/** Scale of the card row for a view of this width/height ratio. */
export function heroRowScale(aspect: number): number {
  return Math.min(1, (aspect * HERO_VIEW_HEIGHT) / HERO_ROW_WIDTH);
}

/** Keeps the total tilt (pointer plus idle sway, both axes) inside the 12 degree limit.
    Scales both axes together, so a diagonal keeps its direction. */
export function clampTilt(x: number, y: number): [number, number] {
  const scale = Math.min(1, HERO_MAX_TILT_RAD / Math.hypot(x, y));
  return [x * scale, y * scale];
}

/** World units to a CSS length for the static cards. Same rule as heroRowScale: the smaller of the
    height fit and the width fit (--stage-width comes from the stage CSS). */
const staticLength = (units: number) =>
  `calc(min(var(--stage-height) / ${HERO_VIEW_HEIGHT}, var(--stage-width) / ${HERO_ROW_WIDTH}) * ${units})`;

/** Size and place of a static card, where the scene shows it at rest. */
export function staticCardStyle({
  x,
  y,
  roll,
}: (typeof HERO_CARD_LAYOUT)[number]) {
  return {
    width: staticLength(HERO_CARD_WIDTH),
    height: staticLength(HERO_CARD_HEIGHT),
    transform: `translate(-50%, -50%) translate(${staticLength(x)}, ${staticLength(-y)}) rotate(${-roll}rad)`,
  };
}

// Fixed sample values: the hero shows no real lobby, game or member (REQ-0001).
const SAMPLE_START = "2030-01-05T19:00:00";
const SAMPLE_PLAYERS = [
  { count: 3, max: 5 },
  { count: 4, max: 6 },
  { count: 2, max: 4 },
] as const;

export function heroCardContents(m: Messages): CardContent[] {
  return SAMPLE_PLAYERS.map(({ count, max }, index) => ({
    gameName: m.landing.heroGames[index],
    timeText: formatTime(SAMPLE_START),
    spotsText: m.lobbyPlayers(count, max),
    spotsFill: count / max,
  }));
}

/** Checks WebGL only without reduced motion, so a reduced-motion visit never creates a WebGL context. */
export function chooseHeroMode(
  reducedMotion: boolean,
  hasWebGL: () => boolean,
): HeroMode {
  return reducedMotion || !hasWebGL() ? "static" : "scene";
}

/** Maps a pointer coordinate to -1..1 inside the box, clamped when the pointer is outside. */
export function pointerToUnit(
  client: number,
  boxStart: number,
  boxSize: number,
): number {
  if (boxSize <= 0) return 0;
  return Math.max(-1, Math.min(1, ((client - boxStart) / boxSize) * 2 - 1));
}

/** Moves the current tilt toward the target by an amount that does not depend on the frame rate. */
export function easeToward(
  current: number,
  target: number,
  seconds: number,
): number {
  return (
    current + (target - current) * (1 - Math.exp(-seconds * HERO_TILT_RESPONSE))
  );
}
