import type { Lobby } from "../../api";
import { weekItems, weekStartOf, type WeekDay } from "../../calendar";

/** A lobby with the group it came from, because the lobby list itself has no group name (ADR 0014). */
export type DashboardLobby = Lobby & { groupId: string; groupName: string };

/** The contract's sort key for lobbies: start time, then id. */
export function byStart(a: Lobby, b: Lobby): number {
  const byTime = Date.parse(a.startsAt) - Date.parse(b.startsAt);
  if (byTime !== 0) return byTime;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function hasNotEnded(lobby: Lobby, now: number): boolean {
  return Date.parse(lobby.endsAt) > now;
}

/** The lobby that starts first among those that have not ended. A running lobby counts. */
export function nextUpOf(
  lobbies: DashboardLobby[],
  now: number,
): DashboardLobby | undefined {
  return lobbies
    .filter((lobby) => hasNotEnded(lobby, now))
    .sort(byStart)
    .at(0);
}

/** Monday to Sunday of the week containing `now`, each day with the lobbies that have not ended, in start order. */
export function thisWeekOf(
  lobbies: DashboardLobby[],
  now: number,
): WeekDay<DashboardLobby>[] {
  const open = lobbies.filter((lobby) => hasNotEnded(lobby, now)).sort(byStart);
  return weekItems(weekStartOf(new Date(now)), open);
}
