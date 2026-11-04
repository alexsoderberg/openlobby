import { useRef } from "react";
import type { Lobby } from "../../api";
import { formatTimeRange, formatWeekday, useMessages } from "../../i18n";
import { isBeforeToday } from "./calendarWeek";
import { endsNextDay } from "./lobbyTime";
import { lobbyPath } from "./lobbyPath";

/** One day with its lobbies. Lobbies that overlap sit side by side, the others follow one after another. */
export function CalendarDay({
  groupId,
  day,
  clusters,
  onCreate,
}: {
  groupId: string;
  day: Date;
  clusters: Lobby[][];
  onCreate: (day: Date, button: HTMLElement) => void;
}) {
  const m = useMessages();
  const addRef = useRef<HTMLButtonElement>(null);
  const canCreate = !isBeforeToday(day);
  // A click on empty space in the column does what the "+" does; the keyboard uses the "+".
  const createFromColumn = (target: HTMLElement) => {
    if (canCreate && addRef.current && !target.closest("a, button"))
      onCreate(day, addRef.current);
  };
  return (
    <li
      className="calendar-day"
      onClick={(event) => createFromColumn(event.target as HTMLElement)}
    >
      <div className="calendar-day__head">
        <h4 className="calendar-day__name">{formatWeekday(day)}</h4>
        {canCreate && (
          <button
            ref={addRef}
            type="button"
            className="calendar-day__add"
            aria-label={m.calendarCreateOnDay(formatWeekday(day))}
            onClick={(event) => onCreate(day, event.currentTarget)}
          >
            <span aria-hidden="true">+</span>
          </button>
        )}
      </div>
      <div className="calendar-day__lobbies">
        {clusters.length === 0 && (
          <p className="calendar-day__empty">{m.calendarNoLobbiesOnDay}</p>
        )}
        {clusters.map((cluster) => (
          <ul key={cluster[0].id} className="calendar-cluster" role="list">
            {cluster.map((lobby) => (
              <CalendarLobby key={lobby.id} groupId={groupId} lobby={lobby} />
            ))}
          </ul>
        ))}
      </div>
    </li>
  );
}

function CalendarLobby({ groupId, lobby }: { groupId: string; lobby: Lobby }) {
  const m = useMessages();
  return (
    <li className="calendar-lobby">
      <a href={lobbyPath(groupId, lobby.id)}>{lobby.gameName}</a>
      <span className="lobby-row__meta">
        {formatTimeRange(lobby.startsAt, lobby.endsAt)}
        {endsNextDay(lobby) && ` (${m.lobbyEndsNextDay})`}
      </span>
      <span className="badge">
        {m.lobbyPlayers(lobby.playerCount, lobby.maxPlayers)}
      </span>
    </li>
  );
}
