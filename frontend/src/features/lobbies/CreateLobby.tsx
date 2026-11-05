import type { PickedStart } from "../../calendar";
import { useMessages } from "../../i18n";
import { ErrorAlert } from "../../ui";
import { CreateLobbyForm } from "./CreateLobbyForm";
import { useCreateLobby } from "./useCreateLobby";
import { useGroupGames } from "./useGroupGames";

/**
 * The create-lobby form with its hook, shown in a popover. A saved lobby is handed to `onCreated`, which
 * closes the popover and refreshes the list. A failed save stays in the form, next to the field it is
 * about.
 */
export function CreateLobby({
  groupId,
  initialStart,
  onCreated,
  onCancel,
  onUnauthenticated,
}: {
  groupId: string;
  initialStart?: PickedStart;
  onCreated: () => void;
  onCancel: () => void;
  onUnauthenticated: () => void;
}) {
  const m = useMessages();
  const games = useGroupGames(groupId, onUnauthenticated);
  const { busy, create } = useCreateLobby(
    groupId,
    onCreated,
    onUnauthenticated,
  );

  return (
    <>
      <h2>{m.lobbyCreateHeading}</h2>
      <GamesAndForm
        games={games}
        busy={busy}
        initialStart={initialStart}
        onCancel={onCancel}
        onSubmit={create}
      />
    </>
  );
}

type FormProps = Parameters<typeof CreateLobbyForm>[0];

/** The form once the games of the group have loaded; until then the loading text or the error. */
function GamesAndForm({
  games: { state, reload },
  ...formProps
}: Omit<FormProps, "games"> & {
  games: ReturnType<typeof useGroupGames>;
}) {
  const m = useMessages();
  if (state.status === "loading") return <p role="status">{m.gamesLoading}</p>;
  if (state.status === "error")
    return <ErrorAlert code={state.code} onRetry={reload} />;
  return <CreateLobbyForm games={state.value} {...formProps} />;
}
