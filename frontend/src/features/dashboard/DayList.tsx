import type { WeekDay } from "../../calendar";
import { formatTimeRange, formatWeekday, useMessages } from "../../i18n";
import { lobbyPath } from "../lobbies";
import type { DashboardLobby } from "./dashboardLobby";

/** A lobby that crosses midnight is on both days of the week grid; the list names it once, on its start day. */
function startingOn(
  days: WeekDay<DashboardLobby>[],
): WeekDay<DashboardLobby>[] {
  return days
    .map(({ day, items }, index) => ({
      day,
      // A lobby that started before Monday is listed under Monday.
      items: items.filter(
        (lobby) => index === 0 || Date.parse(lobby.startsAt) >= day.getTime(),
      ),
    }))
    .filter(({ items }) => items.length > 0);
}

/** Only the days that have lobbies, each with a heading and its lobbies in start order. */
export function DayList({ days }: { days: WeekDay<DashboardLobby>[] }) {
  const m = useMessages();
  const booked = startingOn(days);
  if (booked.length === 0)
    return (
      <p className="empty-state__title">{m.dashboard.nothingBookedWeek}</p>
    );
  return (
    <>
      {booked.map(({ day, items }) => (
        <section key={day.getTime()} aria-labelledby={`day-${day.getTime()}`}>
          <h3 id={`day-${day.getTime()}`}>{formatWeekday(day)}</h3>
          <ul className="row-list" role="list">
            {items.map((lobby) => (
              <li key={lobby.id} className="list-row lobby-row">
                <a
                  className="lobby-row__game"
                  href={lobbyPath(lobby.groupId, lobby.id)}
                >
                  {lobby.gameName}
                </a>
                <span>{formatTimeRange(lobby.startsAt, lobby.endsAt)}</span>
                <span className="lobby-row__meta">{lobby.groupName}</span>
                <span className="badge">
                  {m.lobbyPlayers(lobby.playerCount, lobby.maxPlayers)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
