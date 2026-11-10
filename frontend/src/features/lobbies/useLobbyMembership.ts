import { useEffect, useRef, useState } from "react";
import { INVALID_GAME_ROLE, useApi, type Lobby, type Seat } from "../../api";
import { useChangeAction } from "../../hooks";
import { GAME_ROLE_FULL, LOBBY_FULL, LOBBY_NOT_FOUND } from "./lobbyErrors";

export type Membership = Pick<
  Lobby,
  "id" | "joinedByMe" | "endsAt" | "roleSlots"
>;

/** Answers that mean the seats the player saw are out of date, so the lobby is loaded again. */
const STALE_SEAT_CODES = [LOBBY_FULL, GAME_ROLE_FULL, INVALID_GAME_ROLE];

type Shown = ReturnType<typeof startFrom>;

function startFrom({ id, joinedByMe }: Membership) {
  return {
    id,
    joinedByMe,
    joined: joinedByMe,
    errorCode: undefined as string | undefined,
  };
}

/**
 * The answer sets `joined` at once and the reloaded lobby confirms it later, so the old button never
 * shows again in between. A different lobby or a changed `joinedByMe` starts over from the prop.
 */
function useShownMembership(lobby: Membership) {
  const [shown, setShown] = useState(() => startFrom(lobby));
  if (shown.id !== lobby.id || shown.joinedByMe !== lobby.joinedByMe)
    setShown(startFrom(lobby));
  return [shown, setShown] as const;
}

/** Whether the seat form is open. It replaces the opening button, so focus returns to it on close. */
function useSeatForm(onOpen: () => void) {
  const [choosing, setChoosing] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  const wasChoosing = useRef(false);
  useEffect(() => {
    if (wasChoosing.current && !choosing) opener.current?.focus();
    wasChoosing.current = choosing;
  }, [choosing]);
  const open = () => {
    onOpen();
    setChoosing(true);
  };
  return { choosing, opener, open, close: () => setChoosing(false) };
}

/** Records an answer, unless it is for a lobby that is no longer shown: it must not land on the new one. */
function answered(id: string, code: string | undefined, joinedAfter: boolean) {
  return (now: Shown): Shown =>
    now.id !== id
      ? now
      : { ...now, errorCode: code, joined: code ? now.joined : joinedAfter };
}

/**
 * A gone lobby disappears from the view on leaving; a full one shows its real state. An ended one
 * shows "Ended" without a reload, because a reload drops it (lobby page: not found; card: not upcoming).
 */
function needsReload(code: string | undefined, leaving: boolean) {
  return (
    code === undefined ||
    STALE_SEAT_CODES.includes(code) ||
    (code === LOBBY_NOT_FOUND && leaving)
  );
}

/**
 * The state of the viewer's join, leave and seat change for one lobby: whether they are a player, the last
 * error code, and whether the seat form is open. `onChanged` loads the lobby again.
 */
export function useLobbyMembership(
  groupId: string,
  lobby: Membership,
  onChanged: () => void,
  onUnauthenticated: () => void,
) {
  const api = useApi();
  const { busy, run } = useChangeAction(onUnauthenticated);
  const [shown, setShown] = useShownMembership(lobby);
  const seats = useSeatForm(() =>
    setShown((now) => ({ ...now, errorCode: undefined })),
  );

  async function perform(call: () => Promise<void>, joinedAfter: boolean) {
    const code = await run(call);
    setShown(answered(lobby.id, code, joinedAfter));
    if (code === undefined) seats.close();
    if (needsReload(code, shown.joined)) onChanged();
  }

  return {
    leaving: shown.joined,
    errorCode: shown.errorCode,
    busy,
    choosing: seats.choosing,
    openSeats: seats.open,
    closeSeats: seats.close,
    opener: seats.opener,
    join: (chosen?: Seat) =>
      perform(
        () =>
          chosen
            ? api.joinLobby(groupId, lobby.id, chosen)
            : api.joinLobby(groupId, lobby.id),
        true,
      ),
    leave: () => perform(() => api.leaveLobby(groupId, lobby.id), false),
  };
}
