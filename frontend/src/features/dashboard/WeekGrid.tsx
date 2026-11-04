import type { WeekDay } from "../../calendar";
import { formatDayOfMonth, formatWeekdayShort, useMessages } from "../../i18n";
import type { DashboardLobby } from "./dashboardLobby";
import { LobbyEntry } from "./LobbyEntry";

/** Wide screens: seven columns Monday to Sunday. A day without lobbies says so. */
export function WeekGrid({
  days,
  todayIndex,
}: {
  days: WeekDay<DashboardLobby>[];
  todayIndex: number;
}) {
  const m = useMessages();
  return (
    <ol className="week-grid" role="list">
      {days.map(({ day, items }, index) => (
        <li key={day.getTime()} className="week-column">
          <h3
            className="week-column__title"
            aria-current={index === todayIndex ? "date" : undefined}
          >
            {formatWeekdayShort(day)} {formatDayOfMonth(day)}
          </h3>
          {items.length === 0 ? (
            <p className="week-column__empty">{m.dashboard.nothingBooked}</p>
          ) : (
            <ul className="row-list week-column__lobbies" role="list">
              {items.map((lobby) => (
                <LobbyEntry key={lobby.id} lobby={lobby} />
              ))}
            </ul>
          )}
        </li>
      ))}
    </ol>
  );
}
