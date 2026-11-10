import { useState } from "react";
import { useApi, type LobbyDetail } from "../../api";
import { GenreFrame, GenreName } from "../../genres";
import { formatDateTimeRange, useMessages } from "../../i18n";
import { lobbyLabel, RoleSlots } from "../../lobby";
import { Panel } from "../../ui";
import { DeleteLobbyDialog } from "./DeleteLobbyDialog";
import { LobbyMembership } from "./LobbyMembership";
import { useChangeAction } from "../../hooks";

type Callbacks = { onDeleted: () => void; onUnauthenticated: () => void };
type Props = Callbacks & {
  lobby: LobbyDetail;
  groupId: string;
  isCreator: boolean;
  /** The viewer's seat if they are a player: a game role ID, or `null` for flex. */
  seat?: string | null;
  onMembershipChanged: () => void;
};

/** The game, time, spots and players of a lobby, with join or leave, and a delete button for its creator. */
export function LobbyDetails({
  lobby,
  groupId,
  isCreator,
  seat,
  onMembershipChanged,
  ...callbacks
}: Props) {
  const m = useMessages();
  return (
    <>
      <GenreFrame
        as="header"
        genre={lobby.gameGenre}
        className="lobby-head"
        motif
      >
        <h1>{lobbyLabel(lobby, m)}</h1>
        <GenreName genre={lobby.gameGenre} />
      </GenreFrame>
      <div className="panel-group">
        <Panel>
          <p>{formatDateTimeRange(lobby.startsAt, lobby.endsAt)}</p>
          <p>{m.lobbyPlayers(lobby.playerCount, lobby.maxPlayers)}</p>
          <RoleSlots lobby={lobby} />
          <h2>{m.lobbyPlayersHeading}</h2>
          <PlayerList lobby={lobby} />
          <div className="form-actions">
            <LobbyMembership
              groupId={groupId}
              lobby={lobby}
              onChanged={onMembershipChanged}
              showEnded
              seat={seat}
              onUnauthenticated={callbacks.onUnauthenticated}
            />
            {isCreator && (
              <DeleteLobby lobby={lobby} groupId={groupId} {...callbacks} />
            )}
          </div>
        </Panel>
      </div>
    </>
  );
}

function PlayerList({ lobby }: { lobby: LobbyDetail }) {
  const m = useMessages();
  const { players, roleSlots = [] } = lobby;
  if (players.length === 0) return <p>{m.lobbyNoPlayers}</p>;
  if (roleSlots.length === 0) return <PlayerRows players={players} />;
  const known = new Set(roleSlots.map((slot) => slot.gameRoleId));
  // A player whose game role the lobby no longer lists still counts in playerCount, so keep them visible.
  const unknown = players.filter(
    (p) => p.gameRoleId != null && !known.has(p.gameRoleId),
  );
  const groups = [
    ...roleSlots.map((slot) => ({
      key: slot.gameRoleId,
      name: slot.name,
      players: players.filter((p) => p.gameRoleId === slot.gameRoleId),
    })),
    {
      key: "flex",
      name: m.lobbyFlex(),
      players: players.filter((p) => p.gameRoleId == null),
    },
  ].filter((group) => group.players.length > 0);
  return (
    <>
      {groups.map((group) => (
        <section key={group.key} aria-label={group.name}>
          <h3>{group.name}</h3>
          <PlayerRows players={group.players} />
        </section>
      ))}
      {unknown.length > 0 && <PlayerRows players={unknown} />}
    </>
  );
}

function PlayerRows({ players }: { players: LobbyDetail["players"] }) {
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
  const { busy, run } = useChangeAction(onUnauthenticated);

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
          label={lobbyLabel(lobby, m)}
          busy={busy}
          onConfirm={remove}
          onClose={() => setConfirming(false)}
        />
      )}
    </>
  );
}
