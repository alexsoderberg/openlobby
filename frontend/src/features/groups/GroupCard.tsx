import type { GroupOverview, NextLobby } from "../../api";
import { GenreFrame } from "../../genres";
import { formatDateTime, useMessages } from "../../i18n";
import { lobbyLabel } from "../../lobby";
import { Avatar } from "../../ui";
import { groupPath } from "./groupPath";

/**
 * One group of the Group list: a single link to its Group view (REQ-0024). The whole card is the link's
 * name, so a screen reader reads the name, the member count and the lobby line once. The initials and "+N"
 * are decoration beside the count. No member or player names.
 */
export function GroupCard({
  group,
  now,
}: {
  group: GroupOverview;
  now: number;
}) {
  const m = useMessages();
  const notShown = group.memberCount - group.members.length;
  return (
    <a className="group-card" href={groupPath(group.id)}>
      <span className="group-card__head">
        <span className="group-card__name">{group.name}</span>
        <span className="group-card__count">
          {m.groupMemberCount(group.memberCount)}
        </span>
      </span>
      <span className="group-card__people" aria-hidden="true">
        {group.members.map((member) => (
          <Avatar key={member.userId} name={member.displayName} />
        ))}
        {notShown > 0 && (
          <span className="group-card__more">
            {m.groupMoreMembers(notShown)}
          </span>
        )}
      </span>
      {group.nextLobby ? (
        <NextLobbyLine lobby={group.nextLobby} now={now} />
      ) : (
        <span className="group-card__lobby group-card__lobby--none">
          {m.groupNoUpcomingLobbies}
        </span>
      )}
    </a>
  );
}

/** Label, start and players of the group's Next lobby, in its genre theme. "Running" joins the start; no countdown. */
function NextLobbyLine({ lobby, now }: { lobby: NextLobby; now: number }) {
  const m = useMessages();
  const running = now >= Date.parse(lobby.startsAt);
  return (
    <GenreFrame genre={lobby.gameGenre} className="group-card__lobby">
      <span className="group-card__label">{lobbyLabel(lobby, m)}</span>
      <span className="group-card__when">
        {running && <span className="badge">{m.dashboard.running}</span>}
        <span>{formatDateTime(lobby.startsAt)}</span>
        <span>
          <span className="group-card__dot" aria-hidden="true">
            {m.lobbyMetaSeparator}
          </span>
          {m.lobbyPlayers(lobby.playerCount, lobby.maxPlayers)}
        </span>
      </span>
    </GenreFrame>
  );
}
