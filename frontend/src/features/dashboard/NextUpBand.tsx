import { formatDateTimeRange, formatTime, useMessages } from "../../i18n";
import { lobbyLabel, RoleSlots } from "../../lobby";
import { LobbyMembership, lobbyPath } from "../lobbies";
import { timingText } from "./countdown";
import type { DashboardLobby } from "./dashboardLobby";

/**
 * The band at the top of Home: the lobby that starts first, its start time as the largest text of the page, the
 * label, when, the spots, the role slots and join or leave (REQ-0029 item 4). "Nothing booked" without one. The
 * eyebrow and the countdown are the only signal text of the app (ADR 0028 section 16.4 item 4).
 */
export function NextUpBand({
  lobby,
  now,
  onChanged,
  onUnauthenticated,
}: {
  lobby: DashboardLobby | undefined;
  now: number;
  onChanged: () => void;
  onUnauthenticated: () => void;
}) {
  const m = useMessages();
  return (
    <section className="next-up-band" aria-label={m.dashboard.nextUpHeading}>
      <div className="next-up-band__when">
        <h2 className="next-up-band__eyebrow">
          {lobby
            ? m.dashboard.nextUpEyebrow(timingText(m.dashboard, lobby, now))
            : m.dashboard.nextUpHeading}
        </h2>
        {lobby ? (
          <p className="next-up-band__time">{formatTime(lobby.startsAt)}</p>
        ) : (
          <p className="next-up-band__empty">{m.dashboard.nothingBooked}</p>
        )}
      </div>
      {lobby && (
        <>
          <div className="next-up-band__lobby">
            <h3 className="next-up-band__label">
              <a href={lobbyPath(lobby.groupId, lobby.id)}>
                {lobbyLabel(lobby, m)}
              </a>
            </h3>
            <p className="next-up-band__meta">
              <span>{formatDateTimeRange(lobby.startsAt, lobby.endsAt)}</span>
              <span>{m.lobbyPlayers(lobby.playerCount, lobby.maxPlayers)}</span>
              <span>{lobby.groupName}</span>
            </p>
            <RoleSlots lobby={lobby} />
          </div>
          <div className="next-up-band__actions">
            <LobbyMembership
              groupId={lobby.groupId}
              lobby={lobby}
              onChanged={onChanged}
              onUnauthenticated={onUnauthenticated}
            />
          </div>
        </>
      )}
    </section>
  );
}
