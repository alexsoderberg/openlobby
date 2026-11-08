import { GenreFrame, GenreName } from "../../genres";
import { formatDateTime, useMessages } from "../../i18n";
import { Meter } from "../../ui";
import { LobbyMembership, lobbyPath } from "../lobbies";
import { timingText } from "./countdown";
import type { DashboardLobby } from "./dashboardLobby";

/** The lobby that starts first, with join or leave. No player names (ADR 0014). */
export function NextUpCard({
  lobby,
  now,
  onChanged,
  onUnauthenticated,
}: {
  lobby: DashboardLobby;
  now: number;
  onChanged: () => void;
  onUnauthenticated: () => void;
}) {
  const m = useMessages();
  return (
    <GenreFrame as="article" genre={lobby.gameGenre} className="next-up" motif>
      <div>
        <p className="next-up__timing">{timingText(m.dashboard, lobby, now)}</p>
        <h3 className="next-up__game">
          <a href={lobbyPath(lobby.groupId, lobby.id)}>{lobby.gameName}</a>
        </h3>
        <GenreName genre={lobby.gameGenre} />
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
        <LobbyMembership
          groupId={lobby.groupId}
          lobby={lobby}
          onChanged={onChanged}
          onUnauthenticated={onUnauthenticated}
        />
      </div>
    </GenreFrame>
  );
}
