import { useState } from "react";
import { useApi, type LobbyDetail } from "../../api";
import { useMessages } from "../../i18n";
import { ErrorAlert, Panel } from "../../ui";
import { DeleteLobbyDialog } from "./DeleteLobbyDialog";
import { formatLobbyWhen } from "./lobbyFormat";
import { useLobby } from "./useLobby";
import { useLobbyAction } from "./useLobbyAction";

type Props = {
  groupId: string;
  lobbyId: string;
  /** The viewer. Only the lobby's creator is offered the delete button; the server enforces it too. */
  userId: string;
  backHref: string;
  onDeleted: () => void;
  onUnauthenticated: () => void;
};

/** A lobby with its players. A lobby that has ended is shown as not found, the same as a missing one. */
export function LobbyDetailPage(props: Props) {
  const m = useMessages();
  const { state, reload } = useLobby(
    props.groupId,
    props.lobbyId,
    props.onUnauthenticated,
  );

  return (
    <>
      <p className="crumb">
        <a href={props.backHref}>{m.lobbyBackToGroup}</a>
      </p>
      {state.status === "loading" && <p role="status">{m.lobbyLoading}</p>}
      {state.status === "error" && (
        <ErrorAlert code={state.code} onRetry={reload} />
      )}
      {state.status === "notFound" && <LobbyNotFound />}
      {state.status === "loaded" && (
        <LobbyDetails lobby={state.lobby} {...props} />
      )}
    </>
  );
}

function LobbyNotFound() {
  const m = useMessages();
  return (
    <>
      <h1>{m.lobbyNotFoundHeading}</h1>
      <Panel>
        <p>{m.lobbyNotFoundText}</p>
      </Panel>
    </>
  );
}

function LobbyDetails({
  lobby,
  groupId,
  userId,
  onDeleted,
  onUnauthenticated,
}: Props & { lobby: LobbyDetail }) {
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
      <h1>{lobby.gameName}</h1>
      <div className="panel-group">
        <Panel>
          <p>{formatLobbyWhen(lobby)}</p>
          <p>{m.lobbyPlayers(lobby.playerCount, lobby.maxPlayers)}</p>
          <h2>{m.lobbyPlayersHeading}</h2>
          <PlayerList players={lobby.players} />
          {lobby.createdByUserId === userId && (
            <button
              type="button"
              className="button button--secondary"
              onClick={() => setConfirming(true)}
            >
              {m.lobbyDelete}
            </button>
          )}
        </Panel>
      </div>
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
