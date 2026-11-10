import { toLobbyMessage, useMessages } from "../../i18n";
import { Alert } from "../../ui";
import { LOBBY_HAS_ENDED, LOBBY_NOT_FOUND } from "./lobbyErrors";
import { SeatForm } from "./SeatForm";
import { useLobbyMembership, type Membership } from "./useLobbyMembership";

function hasEnded({ endsAt }: Membership): boolean {
  return Date.parse(endsAt) <= Date.now();
}

/**
 * "Join lobby" or "Leave lobby" for the viewer. A player can always leave; joining is offered until the
 * lobby has ended; a full lobby answers with the full message. A lobby with game roles asks for a seat
 * first, and a player who knows their seat can change it. `onChanged` loads the lobby again.
 */
export function LobbyMembership({
  groupId,
  lobby,
  onChanged,
  onUnauthenticated,
  showEnded = false,
  seat,
}: {
  groupId: string;
  lobby: Membership;
  onChanged: () => void;
  onUnauthenticated: () => void;
  /**
   * Says "Ended" in place of the join button once the clock passes the end. Off where the view already
   * shows the state; a lobby_has_ended answer shows "Ended" everywhere.
   */
  showEnded?: boolean;
  /** The viewer's seat if known: a game role ID, or `null` for flex. Without it a player cannot change seat. */
  seat?: string | null;
}) {
  const m = useMessages();
  const {
    leaving,
    errorCode,
    busy,
    choosing,
    closeSeats,
    openSeats,
    opener,
    join,
    leave,
  } = useLobbyMembership(groupId, lobby, onChanged, onUnauthenticated);
  const hasSeats = (lobby.roleSlots?.length ?? 0) > 0;

  const ended = errorCode === LOBBY_HAS_ENDED || hasEnded(lobby);
  if (!leaving && ended)
    return showEnded || errorCode === LOBBY_HAS_ENDED ? (
      <p role="status">{m.lobbyEnded}</p>
    ) : null;
  const failure =
    errorCode === LOBBY_NOT_FOUND
      ? m.lobbyGone
      : toLobbyMessage(errorCode ?? "");

  if (choosing && lobby.roleSlots)
    return (
      <SeatForm
        roleSlots={lobby.roleSlots}
        seat={leaving ? seat : undefined}
        submitLabel={leaving ? m.lobbySeatSave : m.lobbySeatJoin}
        busy={busy}
        error={errorCode === undefined ? undefined : failure}
        onSubmit={join}
        onCancel={closeSeats}
      />
    );

  return (
    <>
      {errorCode !== undefined && <Alert>{failure}</Alert>}
      {leaving && hasSeats && seat !== undefined && (
        <button
          ref={opener}
          type="button"
          className="button button--secondary"
          disabled={busy}
          onClick={openSeats}
        >
          {m.lobbySeatChange}
        </button>
      )}
      <button
        ref={leaving ? undefined : opener}
        type="button"
        className={leaving ? "button button--secondary" : "button"}
        disabled={busy}
        onClick={leaving ? leave : hasSeats ? openSeats : () => join()}
      >
        {leaving ? m.lobbyLeave : m.lobbyJoin}
      </button>
    </>
  );
}
