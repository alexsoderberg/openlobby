import type { Group, Lobby } from "../../api";
import { GenreFrame, GenreName } from "../../genres";
import { formatDateTimeRange, useMessages } from "../../i18n";
import { lobbyLabel, RoleSlots } from "../../lobby";
import { creatorName } from "./creatorName";
import { lobbyPath } from "./lobbyPath";

/** The lobbies as rows, in the order the server gives them (by start). */
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
    <ul className="row-list" role="list">
      {lobbies.map((lobby) => (
        <LobbyRow
          key={lobby.id}
          groupId={groupId}
          lobby={lobby}
          members={members}
        />
      ))}
    </ul>
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
  return (
    <GenreFrame as="li" genre={lobby.gameGenre} className="list-row lobby-row">
      <a className="lobby-row__game" href={lobbyPath(groupId, lobby.id)}>
        {lobbyLabel(lobby, m)}
      </a>
      <GenreName genre={lobby.gameGenre} />
      <span>{formatDateTimeRange(lobby.startsAt, lobby.endsAt)}</span>
      <span className="lobby-row__meta">{m.lobbyCreatedBy(creator)}</span>
      <span className="badge">
        {m.lobbyPlayers(lobby.playerCount, lobby.maxPlayers)}
      </span>
      <RoleSlots lobby={lobby} />
    </GenreFrame>
  );
}
