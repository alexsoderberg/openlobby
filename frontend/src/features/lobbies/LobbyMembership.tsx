import { useState } from "react";
import { useApi, type Lobby } from "../../api";
import { toUserMessage, useMessages } from "../../i18n";
import { Alert } from "../../ui";
import { LOBBY_FULL, LOBBY_HAS_ENDED, LOBBY_NOT_FOUND } from "./lobbyErrors";
import { useLobbyAction } from "./useLobbyAction";

type Membership = Pick<Lobby, "id" | "joinedByMe" | "endsAt">;

function hasEnded({ endsAt }: Membership): boolean {
  return Date.parse(endsAt) <= Date.now();
}

/**
 * "Join lobby" or "Leave lobby" for the viewer. A player can always leave; joining is offered until the
 * lobby has ended; a full lobby answers with the full message. `onChanged` loads the lobby again.
 */
export function LobbyMembership({
  groupId,
  lobby,
  onChanged,
  onUnauthenticated,
  showEnded = false,
}: {
  groupId: string;
  lobby: Membership;
  onChanged: () => void;
  onUnauthenticated: () => void;
  /** Says "Ended" in place of the join button once the clock passes the end. Off where the view already shows
   * the state; a lobby_has_ended answer shows "Ended" everywhere. */
  showEnded?: boolean;
}) {
  const m = useMessages();
  const api = useApi();
  const { busy, run } = useLobbyAction(onUnauthenticated);
  const [errorCode, setErrorCode] = useState<string>();
  const leaving = lobby.joinedByMe;

  async function toggle() {
    const code = await run(() =>
      leaving
        ? api.leaveLobby(groupId, lobby.id)
        : api.joinLobby(groupId, lobby.id),
    );
    setErrorCode(code);
    // A gone lobby disappears from the view on leaving; a full one shows its real state. An ended one
    // shows "Ended" without a reload, because a reload drops it (lobby page: not found; card: not upcoming).
    if (
      code === undefined ||
      code === LOBBY_FULL ||
      (code === LOBBY_NOT_FOUND && leaving)
    )
      onChanged();
  }

  const ended = errorCode === LOBBY_HAS_ENDED || hasEnded(lobby);
  if (!leaving && ended)
    return showEnded || errorCode === LOBBY_HAS_ENDED ? (
      <p>{m.lobbyEnded}</p>
    ) : null;
  const failure =
    errorCode === LOBBY_NOT_FOUND
      ? m.lobbyGone
      : toUserMessage(errorCode ?? "");

  return (
    <>
      {errorCode !== undefined && <Alert>{failure}</Alert>}
      <button
        type="button"
        className={leaving ? "button button--secondary" : "button"}
        disabled={busy}
        onClick={toggle}
      >
        {leaving ? m.lobbyLeave : m.lobbyJoin}
      </button>
    </>
  );
}
