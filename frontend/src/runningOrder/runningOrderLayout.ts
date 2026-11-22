import { dayAfter, type Span } from "./week";

const MINUTES_PER_HOUR = 60;
export const DAY_MINUTES = 24 * MINUTES_PER_HOUR;

/** The part of a lobby that falls on one day, in minutes from that day's midnight, and its lane in the day's row. */
export type Segment<T extends Span> = {
  lobby: T;
  startMinute: number;
  endMinute: number;
  continuesBefore: boolean;
  continuesAfter: boolean;
  lane: number;
};

/** Wall-clock minutes, so a day with a daylight-saving shift still reads 00:00 to 24:00 on the axis. */
const minuteOfDay = (moment: Date) =>
  moment.getHours() * MINUTES_PER_HOUR + moment.getMinutes();

function segmentOf<T extends Span>(
  day: Date,
  lobby: T,
): Omit<Segment<T>, "lane"> {
  const start = new Date(lobby.startsAt);
  const end = new Date(lobby.endsAt);
  const nextDay = dayAfter(day);
  return {
    lobby,
    startMinute: start < day ? 0 : minuteOfDay(start),
    endMinute: end >= nextDay ? DAY_MINUTES : minuteOfDay(end),
    continuesBefore: start < day,
    continuesAfter: end > nextDay,
  };
}

/**
 * The segments of one day's lobbies, cut at midnight, in start order. Each takes the lowest lane that is free at
 * its start, so no block hides another (ADR 0028 section 4). `lanes` is the row's lane count, at least one.
 */
export function daySegments<T extends Span>(
  day: Date,
  lobbies: T[],
): { segments: Segment<T>[]; lanes: number } {
  const laneEnds: number[] = [];
  const segments = lobbies
    .map((lobby) => segmentOf(day, lobby))
    .sort((a, b) => a.startMinute - b.startMinute)
    .map((segment) => {
      const free = laneEnds.findIndex((end) => end <= segment.startMinute);
      const lane = free === -1 ? laneEnds.length : free;
      laneEnds[lane] = segment.endMinute;
      return { ...segment, lane };
    });
  return { segments, lanes: Math.max(laneEnds.length, 1) };
}

/** Where the Now line stands on the axis: minutes since midnight over the day, 0 to 1. */
export const nowPosition = (now: Date) => minuteOfDay(now) / DAY_MINUTES;

/** Below this much visible axis (phones) the opening puts the first open lobby at the left edge. */
const WINDOW_MINUTES = 12 * MINUTES_PER_HOUR;
/** The latest a wide window starts: 08:00, so a 16-hour window reaches midnight. */
const LATEST_WINDOW_START = 8 * MINUTES_PER_HOUR;

const toHour = (minute: number) =>
  Math.floor(minute / MINUTES_PER_HOUR) * MINUTES_PER_HOUR;

/**
 * The minute the running order scrolls to on opening, given how many minutes of the axis are visible.
 * - Narrow (phones, under 12 hours visible): the full hour at or before the start of the first lobby that has not
 *   ended at `now`, a Running one included, else of `now` (REQ-0019 on the time axis).
 * - Wide: a window that holds the lobbies: from the earliest start hour of the day among the lobbies that have not
 *   ended, else the hour of `now`, but never later than 08:00 and never so late that the window passes 24:00.
 * - The whole day visible: 00:00.
 * A lobby that started before `from` (the first day shown) counts from that day's midnight.
 */
export function openingMinute(
  lobbies: Span[],
  from: Date,
  now: Date,
  visibleMinutes: number,
): number {
  if (visibleMinutes >= DAY_MINUTES) return 0;
  const open = lobbies
    .filter((lobby) => new Date(lobby.endsAt) > now)
    .map((lobby) => new Date(lobby.startsAt));
  const minuteOf = (start: Date) => (start < from ? 0 : minuteOfDay(start));
  if (visibleMinutes < WINDOW_MINUTES) {
    const first =
      open.length > 0 ? new Date(Math.min(...open.map(Number))) : now;
    return toHour(minuteOf(first));
  }
  const candidates = open.length > 0 ? open.map(minuteOf) : [minuteOfDay(now)];
  const earliest = Math.min(LATEST_WINDOW_START, ...candidates);
  return Math.min(toHour(earliest), DAY_MINUTES - visibleMinutes);
}
