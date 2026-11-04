import { useState } from "react";
import { useApi, type LobbyDetail } from "../../api";
import { formatDateTimeRange, useMessages } from "../../i18n";
import { Panel } from "../../ui";
import { DeleteLobbyDialog } from "./DeleteLobbyDialog";
import { useLobbyAction } from "./useLobbyAction";

type Callbacks = { onDeleted: () => void; onUnauthenticated: () => void };

/** The game, time, spots and players of a lobby, with a delete button for its creator. */
export function LobbyDetails({
  lobby,
  groupId,
  isCreator,
  ...callbacks
}: Callbacks & { lobby: LobbyDetail; groupId: string; isCreator: boolean }) {
  const m = useMessages();
  return (
    <>
      <h1>{lobby.gameName}</h1>
      <div className="panel-group">
        <Panel>
          <p>{formatDateTimeRange(lobby.startsAt, lobby.endsAt)}</p>
          <p>{m.lobbyPlayers(lobby.playerCount, lobby.maxPlayers)}</p>
          <h2>{m.lobbyPlayersHeading}</h2>
          <PlayerList players={lobby.players} />
          {isCreator && (
            <DeleteLobby lobby={lobby} groupId={groupId} {...callbacks} />
          )}
        </Panel>
      </div>
    </>
  );
}

function PlayerList({ players }: { players: LobbyDetail["players"] }) {
  const m = useMessages();
  if (players.length === 0) return <p>{m.lobbyNoPlayers}</p>;
  return (
    <ul className="row-list" role="list">
      {players.map((player) => (
        <li key={player.userId} className="list-row">
          <span className="avatar" />
          {player.displayName}
        </li>
      ))}
    </ul>
  );
}

/** The delete button and its confirmation. */
function DeleteLobby({
  lobby,
  groupId,
  onDeleted,
  onUnauthenticated,
}: Callbacks & { lobby: LobbyDetail; groupId: string }) {
  const m = useMessages();
  const api = useApi();
  const [confirming, setConfirming] = useState(false);
  const { busy, run } = useLobbyAction(onUnauthenticated);

  async function remove() {
    const code = await run(() => api.deleteLobby(groupId, lobby.id));
    if (code === undefined) onDeleted();
    return code;
  }

  return (
    <>
      <button
        type="button"
        className="button button--secondary"
        onClick={() => setConfirming(true)}
      >
        {m.lobbyDelete}
      </button>
      {confirming && (
        <DeleteLobbyDialog
          lobby={lobby}
          busy={busy}
          onConfirm={remove}
          onClose={() => setConfirming(false)}
        />
      )}
    </>
  );
}
