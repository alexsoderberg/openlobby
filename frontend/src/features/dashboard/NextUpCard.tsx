import { formatDateTime, useMessages } from "../../i18n";
import { Meter } from "../../ui";
import { lobbyPath } from "../lobbies";
import { timingText } from "./countdown";
import type { DashboardLobby } from "./dashboardLobby";

/** The lobby that starts first. No player names and no join button: those come with REQ-0005. */
export function NextUpCard({
  lobby,
  now,
}: {
  lobby: DashboardLobby;
  now: number;
}) {
  const m = useMessages();
  return (
    <article className="next-up">
      <div>
        <p className="next-up__timing">{timingText(m.dashboard, lobby, now)}</p>
        <h3 className="next-up__game">
          <a href={lobbyPath(lobby.groupId, lobby.id)}>{lobby.gameName}</a>
        </h3>
        <p className="next-up__meta">
          {formatDateTime(lobby.startsAt)} · {lobby.groupName}
        </p>
      </div>
      <div className="next-up__spots">
        <p className="next-up__figure">
          {m.lobbyPlayers(lobby.playerCount, lobby.maxPlayers)}
        </p>
        {lobby.maxPlayers !== null && (
          <Meter
            value={Math.min(lobby.playerCount, lobby.maxPlayers)}
            max={lobby.maxPlayers}
            label={m.dashboard.playersMeter}
          />
        )}
      </div>
    </article>
  );
}
