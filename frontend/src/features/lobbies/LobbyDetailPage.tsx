import type { Group, LobbyDetail } from "../../api";
import { useMessages } from "../../i18n";
import { ErrorAlert, Icon, Panel } from "../../ui";
import { LobbyDetails } from "./LobbyDetails";
import { useLobby } from "./useLobby";

/** A lobby with its players. A lobby that has ended is shown as not found, the same as a missing one. */
export function LobbyDetailPage({
  groupId,
  lobbyId,
  group,
  userId,
  backHref,
  onDeleted,
  onUnauthenticated,
}: {
  groupId: string;
  lobbyId: string;
  /** The lobby's group once loaded: its name is the back link, its members name the creator (REQ-0029 item 6). */
  group?: Pick<Group, "name" | "members">;
  /** The viewer. Only the creator of the lobby is offered the delete button; the server enforces it too. */
  userId: string;
  backHref: string;
  onDeleted: () => void;
  onUnauthenticated: () => void;
}) {
  const m = useMessages();
  const { state, reload, refresh } = useLobby(
    groupId,
    lobbyId,
    onUnauthenticated,
  );

  return (
    <>
      <p className="crumb">
        <a href={backHref}>
          <Icon name="back" />
          {group?.name ?? m.lobbyBackToGroup}
        </a>
      </p>
      {state.status === "loading" && <p role="status">{m.lobbyLoading}</p>}
      {state.status === "error" && (
        <ErrorAlert code={state.code} onRetry={reload} />
      )}
      {state.status === "notFound" && <LobbyNotFound />}
      {state.status === "loaded" && (
        <LobbyDetails
          lobby={state.lobby}
          groupId={groupId}
          userId={userId}
          members={group?.members}
          isCreator={state.lobby.createdByUserId === userId}
          seat={seatOf(state.lobby, userId)}
          onDeleted={onDeleted}
          onMembershipChanged={refresh}
          onUnauthenticated={onUnauthenticated}
        />
      )}
    </>
  );
}

/** The viewer's game role ID, `null` for flex, or undefined when the viewer is no player. */
function seatOf({ players }: LobbyDetail, userId: string) {
  const me = players.find((player) => player.userId === userId);
  return me && (me.gameRoleId ?? null);
}

function LobbyNotFound() {
  const m = useMessages();
  return (
    <>
      <h1>{m.lobbyNotFoundHeading}</h1>
      <Panel>
        <p>{m.lobbyNotFoundText}</p>
      </Panel>
    </>
  );
}
