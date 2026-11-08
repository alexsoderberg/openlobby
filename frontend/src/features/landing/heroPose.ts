import type { HeroFrame } from "./heroCycle";

/** Where the cards rest and how they move. The units are world units of the scene; the stage CSS shares them. */
export const HERO_VIEW_HEIGHT = 3.6;
export const HERO_CARD_WIDTH = 2.6;
/** The painted card is 640 x 400, so its height follows the width. */
export const HERO_CARD_HEIGHT = (HERO_CARD_WIDTH * 400) / 640;
export const HERO_CAMERA_FOV_DEG = 30;
/** Distance at which the camera sees exactly HERO_VIEW_HEIGHT. */
export const HERO_CAMERA_DISTANCE =
  HERO_VIEW_HEIGHT / 2 / Math.tan((HERO_CAMERA_FOV_DEG / 2) * (Math.PI / 180));

/** 12 degrees, the tilt limit in REQ-0013. */
export const HERO_MAX_TILT_RAD = (12 * Math.PI) / 180;
/** Higher is snappier: the share of the remaining tilt closed per second. */
export const HERO_TILT_RESPONSE = 6;

export interface HeroPlace {
  x: number;
  y: number;
  /** Depth: toward the viewer is positive. */
  z: number;
  /** Roll in radians. */
  roll: number;
}
type Pose = HeroPlace & { opacity: number };

/** The focused card is in front, the next one behind it. */
export const HERO_FRONT: HeroPlace = { x: 0.55, y: -0.1, z: 0.5, roll: 0 };
export const HERO_BEHIND: HeroPlace = { x: -0.55, y: 0.3, z: -0.4, roll: 0.06 };
/** Where a card leaves to (up and toward the viewer while it fades), and where an unused card waits. */
export const HERO_AWAY: HeroPlace = { x: 0.55, y: 0.6, z: 1.2, roll: 0 };
/** Width of the row of cards in world units. A narrower view scales the row down to fit. */
export const HERO_ROW_WIDTH =
  2 * Math.max(Math.abs(HERO_FRONT.x), Math.abs(HERO_BEHIND.x)) +
  HERO_CARD_WIDTH;

const mix = (from: number, to: number, amount: number) =>
  from + (to - from) * amount;
const smooth = (t: number) => t * t * (3 - 2 * t);
const between = (
  from: HeroPlace,
  to: HeroPlace,
  t: number,
  fromOpacity = 1,
  toOpacity = 1,
): Pose => ({
  x: mix(from.x, to.x, t),
  y: mix(from.y, to.y, t),
  z: mix(from.z, to.z, t),
  roll: mix(from.roll, to.roll, t),
  opacity: mix(fromOpacity, toOpacity, t),
});

/** Where a card is in a frame: in front while focused, behind while next, otherwise gone. */
export function heroCardPose(
  index: number,
  frame: HeroFrame,
  cardCount: number,
): Pose {
  const t = smooth(frame.progress);
  const place = (index - frame.focusIndex + cardCount) % cardCount;
  if (place === 0) {
    if (frame.phase === "enter") return between(HERO_BEHIND, HERO_FRONT, t);
    if (frame.phase === "leave") return between(HERO_FRONT, HERO_AWAY, t, 1, 0);
    return { ...HERO_FRONT, opacity: 1 };
  }
  if (place === 1)
    return { ...HERO_BEHIND, opacity: frame.phase === "enter" ? t : 1 };
  return { ...HERO_AWAY, opacity: 0 };
}

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

/** Size and place of a static card, where the scene shows it at rest. Depth makes a near card larger, as in the scene. */
export function staticCardStyle({ x, y, z, roll }: HeroPlace) {
  const nearness = HERO_CAMERA_DISTANCE / (HERO_CAMERA_DISTANCE - z);
  return {
    width: staticLength(HERO_CARD_WIDTH * nearness),
    height: staticLength(HERO_CARD_HEIGHT * nearness),
    transform: `translate(-50%, -50%) translate(${staticLength(x * nearness)}, ${staticLength(-y * nearness)}) rotate(${-roll}rad)`,
    zIndex: z > 0 ? 1 : 0,
  };
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
