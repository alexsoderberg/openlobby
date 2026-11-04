import { dayAfter, type Span } from "./week";

export const DAY_MINUTES = 24 * 60;
const HALF_HOUR = 30;
const FIRST_SCROLL_MINUTE = 16 * 60;
const KEYBOARD_START_MINUTE = 18 * 60;

/** The part of an item that falls on one day, in minutes from that day's midnight. */
export type Segment<T extends Span> = {
  item: T;
  startMinute: number;
  endMinute: number;
  continuesBefore: boolean;
  continuesAfter: boolean;
};

/** A segment with its place among the segments that overlap it: column `column` of `columns`. */
export type Block<T extends Span> = Segment<T> & {
  column: number;
  columns: number;
};

/** Wall-clock minutes, so a day with a daylight-saving shift still reads 00:00 to 24:00 on the grid. */
const minuteOfDay = (moment: Date) =>
  moment.getHours() * 60 + moment.getMinutes();

function segmentOf<T extends Span>(day: Date, item: T): Segment<T> {
  const start = new Date(item.startsAt);
  const end = new Date(item.endsAt);
  const nextDay = dayAfter(day);
  return {
    item,
    startMinute: start < day ? 0 : minuteOfDay(start),
    endMinute: end >= nextDay ? DAY_MINUTES : minuteOfDay(end),
    continuesBefore: start < day,
    continuesAfter: end > nextDay,
  };
}

/**
 * Places segments side by side where they overlap. Each run of overlapping segments is one cluster whose
 * members share the width; a segment takes the first column that is free when it starts.
 */
function packColumns<T extends Span>(segments: Segment<T>[]): Block<T>[] {
  const sorted = [...segments].sort(
    (a, b) => a.startMinute - b.startMinute || b.endMinute - a.endMinute,
  );
  const blocks: Block<T>[] = [];
  let cluster: Block<T>[] = [];
  let columnEnds: number[] = [];
  let clusterEnd = 0;
  const closeCluster = () => {
    cluster.forEach((block) => (block.columns = columnEnds.length));
    blocks.push(...cluster);
    cluster = [];
    columnEnds = [];
  };
  for (const segment of sorted) {
    if (segment.startMinute >= clusterEnd) closeCluster();
    let column = columnEnds.findIndex((end) => end <= segment.startMinute);
    if (column === -1) column = columnEnds.length;
    columnEnds[column] = segment.endMinute;
    cluster.push({ ...segment, column, columns: 0 });
    clusterEnd = Math.max(clusterEnd, segment.endMinute);
  }
  closeCluster();
  return blocks;
}

/** The blocks of one day: every item that touches it, cut at midnight and packed side by side. */
export function dayBlocks<T extends Span>(day: Date, items: T[]): Block<T>[] {
  return packColumns(items.map((item) => segmentOf(day, item)));
}

/** The minute the grid scrolls to on opening: 16:00, or the hour of the earliest block if that is earlier. */
export function initialScrollMinute(blocks: { startMinute: number }[]): number {
  const earliest = Math.min(...blocks.map((block) => block.startMinute));
  return Math.min(FIRST_SCROLL_MINUTE, Math.floor(earliest / 60) * 60);
}

/** The minute from which a new lobby can be started on `day`: 0 for a later day, now for today, none for the past. */
export function clickableFromMinute(day: Date, now: Date): number | undefined {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (day < today) return undefined;
  return day.getTime() === today.getTime() ? minuteOfDay(now) : 0;
}

export const roundDownToHalfHour = (minute: number) =>
  Math.floor(minute / HALF_HOUR) * HALF_HOUR;

/** The start for someone who opens the form from the keyboard, so no pointer position is known: the evening, or the next half hour when that has passed. */
export function keyboardStartMinute(fromMinute: number): number {
  const nextHalfHour = Math.ceil(fromMinute / HALF_HOUR) * HALF_HOUR;
  return Math.min(
    Math.max(nextHalfHour, KEYBOARD_START_MINUTE),
    DAY_MINUTES - HALF_HOUR,
  );
}

/** The moment `minute` after midnight of `day`, in local time. */
export function momentAt(day: Date, minute: number): Date {
  return new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    Math.floor(minute / 60),
    minute % 60,
  );
}
