const DAYS_IN_WEEK = 7;
const MONDAY = 1;

/** Anything with a start and an end, such as a lobby. */
export type Span = { startsAt: string; endsAt: string };

/** Midnight of the Monday that starts the week containing `date`, in the viewer's time zone. */
export function weekStartOf(date: Date): Date {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const daysSinceMonday =
    (start.getDay() - MONDAY + DAYS_IN_WEEK) % DAYS_IN_WEEK;
  start.setDate(start.getDate() - daysSinceMonday);
  return start;
}

/** Midnight of the day `offset` days from `date`. Built from the calendar date, so a daylight-saving shift cannot move it. */
function daysFrom(date: Date, offset: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + offset);
}

export function nextWeekStart(weekStart: Date): Date {
  return daysFrom(weekStart, DAYS_IN_WEEK);
}

/** Midnight of each of the seven days from `weekStart`. */
export function weekDays(weekStart: Date): Date[] {
  return Array.from({ length: DAYS_IN_WEEK }, (_, offset) =>
    daysFrom(weekStart, offset),
  );
}

/**
 * The position of an item in the week, or undefined when it does not overlap the week. An item is shown on
 * its start day, not split over two days. One that started before Monday and still runs is shown on Monday.
 */
function dayIndexOf(
  weekStart: Date,
  days: Date[],
  item: Span,
): number | undefined {
  const start = Date.parse(item.startsAt);
  const weekEnd = nextWeekStart(weekStart).getTime();
  if (start >= weekEnd || Date.parse(item.endsAt) <= weekStart.getTime())
    return undefined;
  if (start < weekStart.getTime()) return 0;
  const startDay = new Date(start).toDateString();
  return days.findIndex((day) => day.toDateString() === startDay);
}

export type WeekDay<T extends Span> = { day: Date; items: T[] };

/** The seven days of the week, each with the items shown on it, in the order given. */
export function weekItems<T extends Span>(
  weekStart: Date,
  items: T[],
): WeekDay<T>[] {
  const days = weekDays(weekStart);
  return days.map((day, index) => ({
    day,
    items: items.filter((item) => dayIndexOf(weekStart, days, item) === index),
  }));
}
