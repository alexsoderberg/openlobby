import { useMessages } from "../../i18n";
import { ErrorAlert, Panel } from "../../ui";
import { LobbyDetails } from "./LobbyDetails";
import { useLobby } from "./useLobby";

/** A lobby with its players. A lobby that has ended is shown as not found, the same as a missing one. */
export function LobbyDetailPage({
  groupId,
  lobbyId,
  userId,
  backHref,
  onDeleted,
  onUnauthenticated,
}: {
  groupId: string;
  lobbyId: string;
  /** The viewer. Only the creator of the lobby is offered the delete button; the server enforces it too. */
  userId: string;
  backHref: string;
  onDeleted: () => void;
  onUnauthenticated: () => void;
}) {
  const m = useMessages();
  const { state, reload } = useLobby(groupId, lobbyId, onUnauthenticated);

  return (
    <>
      <p className="crumb">
        <a href={backHref}>{m.lobbyBackToGroup}</a>
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
          isCreator={state.lobby.createdByUserId === userId}
          onDeleted={onDeleted}
          onUnauthenticated={onUnauthenticated}
        />
      )}
    </>
  );
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
