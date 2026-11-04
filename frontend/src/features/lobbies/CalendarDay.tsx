import type { Lobby } from "../../api";
import { useMessages } from "../../i18n";
import { endsNextDay } from "./lobbyTime";
import { formatClockRange, formatDay } from "./lobbyFormat";
import { lobbyPath } from "./lobbyPath";

/** One day with its lobbies. Lobbies that overlap sit side by side, the others follow one after another. */
export function CalendarDay({
  groupId,
  day,
  clusters,
}: {
  groupId: string;
  day: Date;
  clusters: Lobby[][];
}) {
  const m = useMessages();
  return (
    <li className="calendar-day">
      <h4 className="calendar-day__name">{formatDay(day)}</h4>
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
        {formatClockRange(lobby)}
        {endsNextDay(lobby) && ` (${m.lobbyEndsNextDay})`}
      </span>
      <span className="badge">
        {m.lobbyPlayers(lobby.playerCount, lobby.maxPlayers)}
      </span>
    </li>
  );
}
