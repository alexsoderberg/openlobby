import { useRef, useState } from "react";
import { useApi, type CreateLobbyInput } from "../../api";
import { useMessages } from "../../i18n";
import { ErrorAlert, Panel } from "../../ui";
import { CreateLobbyForm } from "./CreateLobbyForm";
import type { SaveResult } from "./lobbyErrors";
import { useGroupGames } from "./useGroupGames";
import { useLobbyAction } from "./useLobbyAction";

/**
 * The create-lobby section. A saved lobby refreshes the list and moves focus to the confirmation, which
 * stays in the page as a live region. A failed save stays in the form, next to the field it is about.
 */
export function CreateLobby({
  groupId,
  onCreated,
  onUnauthenticated,
}: {
  groupId: string;
  onCreated: () => void;
  onUnauthenticated: () => void;
}) {
  const m = useMessages();
  const api = useApi();
  const games = useGroupGames(groupId, onUnauthenticated);
  const { busy, run } = useLobbyAction(onUnauthenticated);
  const [created, setCreated] = useState(false);
  const statusRef = useRef<HTMLParagraphElement>(null);

  async function create(input: CreateLobbyInput): SaveResult {
    setCreated(false);
    const code = await run(() => api.createLobby(groupId, input));
    if (code !== undefined) return code;
    setCreated(true);
    onCreated();
    statusRef.current?.focus();
    return undefined;
  }

  return (
    <Panel>
      <h2>{m.lobbyCreateHeading}</h2>
      {games.state.status === "loading" && (
        <p role="status">{m.gamesLoading}</p>
      )}
      {games.state.status === "error" && (
        <ErrorAlert code={games.state.code} onRetry={games.reload} />
      )}
      {games.state.status === "loaded" && (
        <CreateLobbyForm
          games={games.state.value}
          busy={busy}
          onSubmit={create}
        />
      )}
      <p ref={statusRef} tabIndex={-1} role="status" className="status">
        {created && m.lobbyCreated}
      </p>
    </Panel>
  );
}
