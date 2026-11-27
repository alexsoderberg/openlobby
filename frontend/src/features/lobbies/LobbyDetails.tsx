import { useRef, useState } from "react";
import { useApi, type Group, type LobbyDetail } from "../../api";
import {
  formatTime,
  formatWeekday,
  useMessages,
  type Messages,
} from "../../i18n";
import {
  hasFreeSlot,
  LobbyGameLogo,
  lobbyLabel,
  PreferredGameRolesNote,
  RoleSlots,
  RoleSlotText,
  type RoleSlot,
} from "../../lobby";
import { Attribution, Avatar, Button, Icon, ItemLabel } from "../../ui";
import { creatorName } from "./creatorName";
import { DeleteLobbyDialog } from "./DeleteLobbyDialog";
import { LobbyMembership } from "./LobbyMembership";
import { LobbySettings } from "./LobbySettings";
import { useChangeAction } from "../../hooks";

type Player = LobbyDetail["players"][number];
type Callbacks = { onDeleted: () => void; onUnauthenticated: () => void };
type Props = Callbacks & {
  lobby: LobbyDetail;
  groupId: string;
  /** The viewer: their row in the player list says "You". */
  userId: string;
  /** The group's members, to name the creator; that fact is left out until they are known. */
  members?: Group["members"];
  isCreator: boolean;
  /** The viewer's seat if they are a player: a game role ID, or `null` for flex. */
  seat?: string | null;
  onMembershipChanged: () => void;
};

const dayKey = (moment: string) => new Date(moment).toDateString();

/** The time, game, spots and players of a lobby, with join or leave, its facts and settings, and Delete for its creator. */
export function LobbyDetails({
  lobby,
  groupId,
  userId,
  members,
  isCreator,
  seat,
  onMembershipChanged,
  ...callbacks
}: Props) {
  const m = useMessages();
  const headingRef = useRef<HTMLHeadingElement>(null);
  return (
    <>
      {/* The day, then the time as the largest text of the page (REQ-0029 item 6). Join or leave follows the role slots, or the
          spot count without them (REQ-0028 item 5). */}
      <header className="lobby-head">
        <p className="lobby-head__day">{lobbyDayLine(lobby, m)}</p>
        <p className="lobby-head__time">
          {m.runningOrder.times(
            formatTime(lobby.startsAt),
            formatTime(lobby.endsAt),
          )}
        </p>
        <div className="game-heading">
          <LobbyGameLogo lobby={lobby} />
          <h1 ref={headingRef} tabIndex={-1}>
            {lobbyLabel(lobby, m)}
          </h1>
        </div>
        <p className="lobby-head__spots">
          {m.lobbyPlayers(lobby.playerCount, lobby.maxPlayers)}
        </p>
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
      </header>
      {/* Facts and settings sit between the players and Delete; from 98rem they move to the side column, and
          Delete stays last in the main column (REQ-0025, REQ-0028 item 5). */}
      <div className="side-layout side-layout--lobby">
        <section>
          <h2>{m.lobbyPlayersHeading}</h2>
          <PlayerList lobby={lobby} userId={userId} />
          {lobby.players.some((player) => player.goals?.length) && (
            <Attribution />
          )}
        </section>
        <div className="side-column">
          <LobbyFacts lobby={lobby} members={members} />
          <LobbySettings
            groupId={groupId}
            lobby={lobby}
            headingRef={headingRef}
            onChanged={onMembershipChanged}
            onUnauthenticated={callbacks.onUnauthenticated}
          />
        </div>
        {isCreator && (
          <div className="form-actions">
            <DeleteLobby lobby={lobby} groupId={groupId} {...callbacks} />
          </div>
        )}
      </div>
    </>
  );
}

/** The start day, and the end day too when the lobby ends on another day. */
function lobbyDayLine({ startsAt, endsAt }: LobbyDetail, m: Messages) {
  const start = formatWeekday(startsAt);
  return dayKey(startsAt) === dayKey(endsAt)
    ? start
    : m.lobbyDays(start, formatWeekday(endsAt));
}

/** Game, mode, activity, max players and creator (REQ-0029 item 6). A fact the lobby does not have is left out. */
function LobbyFacts({
  lobby,
  members,
}: {
  lobby: LobbyDetail;
  members?: Group["members"];
}) {
  const m = useMessages();
  const facts: [string, string | null | undefined][] = [
    [m.lobbyGameLabel, lobby.gameName ?? m.lobbyOpen],
    [m.lobbyModeLabel, lobby.modeName],
    [m.lobbyActivityLabel, lobby.activityName],
    [m.lobbyMaxPlayersLabel, lobby.maxPlayers?.toString()],
    [
      m.lobbyCreatorLabel,
      members && creatorName(members, lobby, m.lobbyUnknownCreator),
    ],
  ];
  return (
    <section>
      <h2>{m.lobbyFactsHeading}</h2>
      <dl className="lobby-facts">
        {facts.map(
          ([term, value]) =>
            value && (
              <div key={term}>
                <dt>{term}</dt>
                <dd>{value}</dd>
              </div>
            ),
        )}
      </dl>
    </section>
  );
}

/** A role slot's players, or the flex players when `slot` is absent. */
type PlayerGroup = { key: string; slot?: RoleSlot; players: Player[] };

/**
 * The players by role slot in the lobby's order, flex last, without empty groups; and the players whose game role
 * the lobby no longer lists, who still count in playerCount and so stay visible.
 */
function playerGroups({ players, roleSlots = [] }: LobbyDetail): {
  groups: PlayerGroup[];
  unknown: Player[];
} {
  const known = new Set(roleSlots.map((slot) => slot.gameRoleId));
  const groups = [
    ...roleSlots.map((slot) => ({
      key: slot.gameRoleId,
      slot,
      players: players.filter((p) => p.gameRoleId === slot.gameRoleId),
    })),
    { key: "flex", players: players.filter((p) => p.gameRoleId == null) },
  ].filter((group) => group.players.length > 0);
  const unknown = players.filter(
    (p) => p.gameRoleId != null && !known.has(p.gameRoleId),
  );
  return { groups, unknown };
}

function PlayerList({ lobby, userId }: { lobby: LobbyDetail; userId: string }) {
  const m = useMessages();
  if (lobby.players.length === 0) return <p>{m.lobbyNoPlayers}</p>;
  if (!lobby.roleSlots?.length)
    return <PlayerRows players={lobby.players} userId={userId} />;
  const { groups, unknown } = playerGroups(lobby);
  return (
    <>
      {groups.map(({ key, slot, players }) => (
        <section
          key={key}
          aria-label={slot?.name ?? m.lobbyFlex()}
          className="player-group"
        >
          <h3>
            {slot ? (
              <RoleGroupHeading slot={slot} />
            ) : (
              m.lobbyFlex(players.length)
            )}
          </h3>
          <PlayerRows players={players} userId={userId} />
        </section>
      ))}
      {unknown.length > 0 && <PlayerRows players={unknown} userId={userId} />}
    </>
  );
}

/** "[shield] Tank 1/1", with the check icon of a full role slot as on the role slots (ADR 0028 section 16.4 item 6). */
function RoleGroupHeading({ slot }: { slot: RoleSlot }) {
  const full = !hasFreeSlot(slot);
  return (
    <>
      <RoleSlotText slot={slot} full={full} icon={slot.roleIcon} />
      {full && <Icon name="full" className="role-slot-check" />}
    </>
  );
}

function PlayerRows({
  players,
  userId,
}: {
  players: Player[];
  userId: string;
}) {
  const m = useMessages();
  return (
    <ul className="row-list" role="list">
      {players.map((player) => {
        const me = player.userId === userId;
        return (
          <li
            key={player.userId}
            className={me ? "player-row player-row--me" : "player-row"}
          >
            <Avatar name={player.displayName} />
            <span className="player-row__name">{player.displayName}</span>
            {me && <span className="badge">{m.lobbyPlayerYou}</span>}
            <PreferredGameRolesNote roles={player.preferredGameRoles} />
            <PlayerGoals player={player} />
          </li>
        );
      })}
    </ul>
  );
}

/** The player's goals that can drop in the lobby's dungeon or raid, as the server matched them (REQ-0030). */
function PlayerGoals({
  player: { displayName, goals = [] },
}: {
  player: Player;
}) {
  const m = useMessages().goals;
  if (goals.length === 0) return null;
  return (
    <div className="player-goals">
      <span className="player-goals__title" aria-hidden="true">
        {m.playerGoals}
      </span>
      <ul aria-label={m.playerGoalsLabel(displayName)}>
        {goals.map((item) => (
          <li key={item.itemId}>
            <ItemLabel item={item} />
          </li>
        ))}
      </ul>
    </div>
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
