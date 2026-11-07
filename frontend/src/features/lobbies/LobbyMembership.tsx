import { useState } from "react";
import { useApi, type Lobby } from "../../api";
import { toUserMessage, useMessages } from "../../i18n";
import { Alert } from "../../ui";
import { LOBBY_FULL, LOBBY_HAS_ENDED, LOBBY_NOT_FOUND } from "./lobbyErrors";
import { useChangeAction } from "../../hooks";

type Membership = Pick<Lobby, "id" | "joinedByMe" | "endsAt">;

function hasEnded({ endsAt }: Membership): boolean {
  return Date.parse(endsAt) <= Date.now();
}

function startFrom({ id, joinedByMe }: Membership) {
  return {
    id,
    joinedByMe,
    joined: joinedByMe,
    errorCode: undefined as string | undefined,
  };
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
  /**
   * Says "Ended" in place of the join button once the clock passes the end. Off where the view already
   * shows the state; a lobby_has_ended answer shows "Ended" everywhere.
   */
  showEnded?: boolean;
}) {
  const m = useMessages();
  const api = useApi();
  const { busy, run } = useChangeAction(onUnauthenticated);
  // The answer sets `joined` at once and the reloaded lobby confirms it later, so the old button never
  // shows again in between. A different lobby or a changed `joinedByMe` starts over from the prop.
  const [shown, setShown] = useState(() => startFrom(lobby));
  if (shown.id !== lobby.id || shown.joinedByMe !== lobby.joinedByMe)
    setShown(startFrom(lobby));
  const { joined: leaving, errorCode } = shown;

  async function toggle() {
    const { id } = lobby;
    const code = await run(() =>
      leaving ? api.leaveLobby(groupId, id) : api.joinLobby(groupId, id),
    );
    // An answer for a lobby that is no longer shown must not land on the new one.
    setShown((now) =>
      now.id !== id
        ? now
        : { ...now, errorCode: code, joined: code ? now.joined : !leaving },
    );
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
      <p role="status">{m.lobbyEnded}</p>
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
