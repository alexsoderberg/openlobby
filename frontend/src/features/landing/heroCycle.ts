/** Pure state of the "lobby fills up" cycle (ADR 0016 section 8): no timers, no DOM, no sample data. */
export interface HeroTiming {
  enterSeconds: number;
  stepSeconds: number;
  glowSeconds: number;
  leaveSeconds: number;
}

export interface CountedCard {
  startCount: number;
  maxCount: number;
}

export type HeroPhase = "enter" | "fill" | "full" | "leave";

export interface HeroFrame {
  focusIndex: number;
  /** Players on the focused card. */
  count: number;
  phase: HeroPhase;
  /** 0..1 through the phase. */
  progress: number;
}

const arrivalsOf = (card: CountedCard) => card.maxCount - card.startCount;

export const heroCardSeconds = (card: CountedCard, timing: HeroTiming) =>
  timing.enterSeconds +
  arrivalsOf(card) * timing.stepSeconds +
  timing.glowSeconds +
  timing.leaveSeconds;

/** Which card is in focus after this many seconds, and how many seconds into that card we are. */
function locateCard(
  elapsedSeconds: number,
  cards: readonly CountedCard[],
  timing: HeroTiming,
) {
  const total = cards.reduce(
    (sum, card) => sum + heroCardSeconds(card, timing),
    0,
  );
  let seconds = elapsedSeconds % total;
  let focusIndex = 0;
  while (
    focusIndex < cards.length - 1 &&
    seconds >= heroCardSeconds(cards[focusIndex], timing)
  ) {
    seconds -= heroCardSeconds(cards[focusIndex], timing);
    focusIndex += 1;
  }
  return { focusIndex, seconds };
}

/** The phase of one card, `seconds` into its own cycle: enter, then fill, full and leave. */
function frameInCard(
  card: CountedCard,
  focusIndex: number,
  seconds: number,
  timing: HeroTiming,
): HeroFrame {
  const fillSeconds = arrivalsOf(card) * timing.stepSeconds;
  const fillEnd = timing.enterSeconds + fillSeconds;
  const fullEnd = fillEnd + timing.glowSeconds;
  const frame = (
    phase: HeroPhase,
    count: number,
    from: number,
    length: number,
  ) => ({ focusIndex, count, phase, progress: (seconds - from) / length });

  if (seconds < timing.enterSeconds)
    return frame("enter", card.startCount, 0, timing.enterSeconds);
  if (seconds < fillEnd) {
    const arrived = Math.floor(
      (seconds - timing.enterSeconds) / timing.stepSeconds,
    );
    return frame(
      "fill",
      card.startCount + arrived,
      timing.enterSeconds,
      fillSeconds,
    );
  }
  if (seconds < fullEnd)
    return frame("full", card.maxCount, fillEnd, timing.glowSeconds);
  return frame("leave", card.maxCount, fullEnd, timing.leaveSeconds);
}

/** Where the cycle is after this many seconds. The time wraps, so the cycle never ends. */
export function heroFrameAt(
  elapsedSeconds: number,
  cards: readonly CountedCard[],
  timing: HeroTiming,
): HeroFrame {
  const { focusIndex, seconds } = locateCard(elapsedSeconds, cards, timing);
  return frameInCard(cards[focusIndex], focusIndex, seconds, timing);
}

/** The cards that are not in focus rest at their start count. */
export const heroCardCount = (
  index: number,
  frame: HeroFrame,
  cards: readonly CountedCard[],
) => (index === frame.focusIndex ? frame.count : cards[index].startCount);

/** Frames that look the same apart from motion inside a phase. Used to repaint a card only when it changes. */
export const isSameHeroFrame = (a: HeroFrame | undefined, b: HeroFrame) =>
  a?.focusIndex === b.focusIndex && a.count === b.count && a.phase === b.phase;
