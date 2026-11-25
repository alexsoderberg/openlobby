import { useId } from "react";
import type { Group, Lobby } from "../../api";
import {
  formatDateTime,
  formatTime,
  formatWeekday,
  useMessages,
} from "../../i18n";
import { LobbyGameLogo, lobbyLabel, RoleSlots } from "../../lobby";
import { creatorName } from "./creatorName";
import { lobbyPath } from "./lobbyPath";

const dayKey = (moment: string | Date) => new Date(moment).toDateString();

/** The lobbies in the server's order (by start), grouped by the local day they start on. */
function byDay(lobbies: Lobby[]) {
  const days = new Map<string, Lobby[]>();
  for (const lobby of lobbies) {
    const key = dayKey(lobby.startsAt);
    days.set(key, [...(days.get(key) ?? []), lobby]);
  }
  return [...days.values()];
}

/**
 * The Line-up (REQ-0029 item 5): the lobbies grouped by day under day headings, each a row with the large start
 * time, the end time, the label, the role slots and the spots. The rows of all days share one set of columns.
 */
export function LobbyList({
  groupId,
  lobbies,
  members,
}: {
  groupId: string;
  lobbies: Lobby[];
  members: Group["members"];
}) {
  return (
    <div className="line-up">
      {byDay(lobbies).map((dayLobbies) => (
        <LineUpDay
          key={dayLobbies[0].id}
          groupId={groupId}
          lobbies={dayLobbies}
          members={members}
        />
      ))}
    </div>
  );
}

function LineUpDay({
  groupId,
  lobbies,
  members,
}: {
  groupId: string;
  lobbies: Lobby[];
  members: Group["members"];
}) {
  const m = useMessages();
  const headingId = useId();
  const { startsAt } = lobbies[0];
  const day = formatWeekday(startsAt);
  const today = dayKey(startsAt) === dayKey(new Date());
  return (
    <>
      <h3 id={headingId} className="line-up__day">
        {today ? m.runningOrder.today(day) : day}
      </h3>
      <ul className="row-list line-up__lobbies" aria-labelledby={headingId}>
        {lobbies.map((lobby) => (
          <LobbyRow
            key={lobby.id}
            groupId={groupId}
            lobby={lobby}
            members={members}
          />
        ))}
      </ul>
    </>
  );
}

function LobbyRow({
  groupId,
  lobby,
  members,
}: {
  groupId: string;
  lobby: Lobby;
  members: Group["members"];
}) {
  const m = useMessages();
  const creator = creatorName(members, lobby, m.lobbyUnknownCreator);
  // The day heading holds the start date, so the end shows a date only when it falls on another day.
  const end =
    dayKey(lobby.endsAt) === dayKey(lobby.startsAt)
      ? formatTime(lobby.endsAt)
      : formatDateTime(lobby.endsAt);
  return (
    <li className="lobby-row">
      <p className="lobby-row__time">
        <span className="lobby-row__start">{formatTime(lobby.startsAt)}</span>{" "}
        <span className="lobby-row__end">{m.lineUpEnds(end)}</span>
      </p>
      <div className="lobby-row__main">
        {/* One flex item, so a long label wraps beside its logo, never onto a line of its own. */}
        <div className="game-heading">
          <LobbyGameLogo lobby={lobby} size="regular" />
          <a className="lobby-row__game" href={lobbyPath(groupId, lobby.id)}>
            {lobbyLabel(lobby, m)}
          </a>
        </div>
        <RoleSlots lobby={lobby} />
        <span className="lobby-row__meta">{m.lobbyCreatedBy(creator)}</span>
      </div>
      <p className="lobby-row__spots">
        <span className="lobby-row__figure">
          {m.lineUpSpotsFigure(lobby.playerCount, lobby.maxPlayers)}
        </span>{" "}
        <span className="lobby-row__word">
          {m.lineUpSpotsWord(lobby.playerCount, lobby.maxPlayers)}
        </span>
      </p>
    </li>
  );
}
