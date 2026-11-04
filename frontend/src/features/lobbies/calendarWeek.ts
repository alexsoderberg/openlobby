import type { Lobby } from "../../api";
import { weekItems } from "../../calendar";

export type CalendarDay = { day: Date; clusters: Lobby[][] };

export function calendarWeek(weekStart: Date, lobbies: Lobby[]): CalendarDay[] {
  return weekItems(weekStart, lobbies).map(({ day, items }) => ({
    day,
    clusters: clusterOverlapping(items),
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
