import { useRef } from "react";
import { useMessages } from "../../i18n";
import { ErrorAlert, Panel } from "../../ui";
import { CreateLobbyForm } from "./CreateLobbyForm";
import { useCreateLobby } from "./useCreateLobby";
import { useGroupGames } from "./useGroupGames";

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
  const games = useGroupGames(groupId, onUnauthenticated);
  const { busy, created, create } = useCreateLobby(
    groupId,
    onCreated,
    onUnauthenticated,
  );
  const statusRef = useRef<HTMLParagraphElement>(null);

  return (
    <Panel>
      <h2>{m.lobbyCreateHeading}</h2>
      <GamesAndForm
        games={games}
        busy={busy}
        onSubmit={async (input) => {
          const code = await create(input);
          if (code === undefined) statusRef.current?.focus();
          return code;
        }}
      />
      <p ref={statusRef} tabIndex={-1} role="status" className="status">
        {created && m.lobbyCreated}
      </p>
    </Panel>
  );
}

type FormProps = Parameters<typeof CreateLobbyForm>[0];

/** The form once the games of the group have loaded; until then the loading text or the error. */
function GamesAndForm({
  games: { state, reload },
  busy,
  onSubmit,
}: Pick<FormProps, "busy" | "onSubmit"> & {
  games: ReturnType<typeof useGroupGames>;
}) {
  const m = useMessages();
  if (state.status === "loading") return <p role="status">{m.gamesLoading}</p>;
  if (state.status === "error")
    return <ErrorAlert code={state.code} onRetry={reload} />;
  return (
    <CreateLobbyForm games={state.value} busy={busy} onSubmit={onSubmit} />
  );
}
