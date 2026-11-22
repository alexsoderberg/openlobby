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

/** Midnight that ends `day`. */
export function dayAfter(day: Date): Date {
  return daysFrom(day, 1);
}

/** Whether any part of the item falls on `day` (midnight to midnight, local time). */
function overlapsDay(day: Date, item: Span): boolean {
  return (
    Date.parse(item.startsAt) < dayAfter(day).getTime() &&
    Date.parse(item.endsAt) > day.getTime()
  );
}

export type WeekDay<T extends Span> = { day: Date; items: T[] };

/**
 * The seven days of the week, each with the items that fall on it, in the order given. An item that
 * crosses midnight is on both days; one that started before Monday is on Monday; one that ends after
 * Sunday is on Sunday.
 */
export function weekItems<T extends Span>(
  weekStart: Date,
  items: T[],
): WeekDay<T>[] {
  return weekDays(weekStart).map((day) => ({
    day,
    items: items.filter((item) => overlapsDay(day, item)),
  }));
}
