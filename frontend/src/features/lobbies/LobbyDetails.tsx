import { useState } from "react";
import { useApi, type LobbyDetail } from "../../api";
import { GenreFrame, GenreName } from "../../genres";
import { formatDateTimeRange, useMessages } from "../../i18n";
import {
  LobbyGameLogo,
  lobbyCoverUrl,
  lobbyLabel,
  PreferredGameRolesNote,
  RoleSlots,
} from "../../lobby";
import { Avatar, Button, GameRoleName, Icon, Panel } from "../../ui";
import { DeleteLobbyDialog } from "./DeleteLobbyDialog";
import { LobbyMembership } from "./LobbyMembership";
import { LobbySettings } from "./LobbySettings";
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
        coverUrl={lobbyCoverUrl(lobby)}
      >
        <div className="game-heading">
          <LobbyGameLogo lobby={lobby} />
          <h1>{lobbyLabel(lobby, m)}</h1>
        </div>
        <GenreName genre={lobby.gameGenre} />
      </GenreFrame>
      {/* Join or leave follows the role slots, or the spot count without them; Delete lobby is last in the main
          column. Settings sit between the players and Delete; from 98rem they move to the side column (REQ-0025,
          REQ-0028 item 5). */}
      <div className="panel-group">
        <Panel className="side-layout side-layout--lobby">
          <div className="lobby-summary">
            <p>{formatDateTimeRange(lobby.startsAt, lobby.endsAt)}</p>
            <p>{m.lobbyPlayers(lobby.playerCount, lobby.maxPlayers)}</p>
            <RoleSlots lobby={lobby} />
            <div className="form-actions">
              <LobbyMembership
                groupId={groupId}
                lobby={lobby}
                onChanged={onMembershipChanged}
                showEnded
                seat={seat}
                onUnauthenticated={callbacks.onUnauthenticated}
              />
            </div>
            <h2>{m.lobbyPlayersHeading}</h2>
            <PlayerList lobby={lobby} />
          </div>
          <div className="side-column">
            <LobbySettings
              groupId={groupId}
              lobby={lobby}
              onChanged={onMembershipChanged}
              onUnauthenticated={callbacks.onUnauthenticated}
            />
          </div>
          {isCreator && (
            <div className="form-actions">
              <DeleteLobby lobby={lobby} groupId={groupId} {...callbacks} />
            </div>
          )}
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
      icon: slot.roleIcon,
      players: players.filter((p) => p.gameRoleId === slot.gameRoleId),
    })),
    {
      key: "flex",
      name: m.lobbyFlex(),
      icon: null,
      players: players.filter((p) => p.gameRoleId == null),
    },
  ].filter((group) => group.players.length > 0);
  return (
    <>
      {groups.map((group) => (
        <section key={group.key} aria-label={group.name}>
          <h3>
            <GameRoleName icon={group.icon}>{group.name}</GameRoleName>
          </h3>
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
          <Avatar name={player.displayName} />
          {player.displayName}
          <PreferredGameRolesNote roles={player.preferredGameRoles} />
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

  return (
    <>
      <Button
        type="button"
        variant="danger"
        onClick={() => setConfirming(true)}
      >
        <Icon name="remove" />
        {m.lobbyDelete}
      </Button>
      {confirming && (
        <DeleteLobbyDialog
          label={lobbyLabel(lobby, m)}
          busy={busy}
          onConfirm={() => run(() => api.deleteLobby(groupId, lobby.id))}
          onClose={(deleted) => {
            setConfirming(false);
            if (deleted) onDeleted();
          }}
        />
      )}
    </>
  );
}
