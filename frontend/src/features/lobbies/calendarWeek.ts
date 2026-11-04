import type { Lobby } from "../../api";

const DAYS_IN_WEEK = 7;
const MONDAY = 1;

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

export type CalendarDay = { day: Date; clusters: Lobby[][] };

/** A lobby belongs to its start day. Lobbies that do not start in the week are left out. */
export function calendarWeek(weekStart: Date, lobbies: Lobby[]): CalendarDay[] {
  return weekDays(weekStart).map((day) => ({
    day,
    clusters: clusterOverlapping(
      lobbies.filter(
        (lobby) =>
          new Date(lobby.startsAt).toDateString() === day.toDateString(),
      ),
    ),
  }));
}

/**
 * Groups lobbies (sorted by start) into runs that overlap in time. A run is shown side by side; separate
 * runs are shown one after another, so nothing is hidden or squeezed without need.
 */
export function clusterOverlapping(lobbies: Lobby[]): Lobby[][] {
  const clusters: Lobby[][] = [];
  let clusterEnd = -Infinity;
  for (const lobby of lobbies) {
    if (Date.parse(lobby.startsAt) >= clusterEnd) clusters.push([]);
    clusters[clusters.length - 1].push(lobby);
    clusterEnd = Math.max(clusterEnd, Date.parse(lobby.endsAt));
  }
  return clusters;
}
