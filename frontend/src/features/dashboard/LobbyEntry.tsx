import { formatTimeRange, useMessages } from "../../i18n";
import { endsNextDay, lobbyPath } from "../lobbies";
import type { DashboardLobby } from "./dashboardLobby";

/** One lobby in a week column or the agenda: game, clock time, group and spots. */
export function LobbyEntry({ lobby }: { lobby: DashboardLobby }) {
  const m = useMessages();
  return (
    <li className="calendar-lobby">
      <a className="lobby-row__game" href={lobbyPath(lobby.groupId, lobby.id)}>
        {lobby.gameName}
      </a>
      <span className="lobby-row__meta">
        {formatTimeRange(lobby.startsAt, lobby.endsAt)}
        {endsNextDay(lobby) && ` (${m.lobbyEndsNextDay})`}
      </span>
      <span className="lobby-row__meta">{lobby.groupName}</span>
      <span className="badge">
        {m.lobbyPlayers(lobby.playerCount, lobby.maxPlayers)}
      </span>
    </li>
  );
}
