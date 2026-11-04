import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import type { Game, GameInput } from "../../api";
import { toUserMessage, useMessages } from "../../i18n";
import { Alert, Panel } from "../../ui";
import { DeleteGameDialog } from "./DeleteGameDialog";
import { GameForm } from "./GameForm";
import { GameList } from "./GameList";
import { NOT_ALLOWED } from "./gameErrors";
import { useGameChanges, type GameChange } from "./useGameChanges";
import { useGames } from "./useGames";

/**
 * The system admin's game list. The role is decided by the server; `isSystemAdmin` only avoids a
 * request that would be refused, so a non-admin never loads or sees the list.
 */
export function GamesPage({
  isSystemAdmin,
  onUnauthenticated,
}: {
  isSystemAdmin: boolean;
  onUnauthenticated: () => void;
}) {
  const m = useMessages();
  return (
    <>
      <h1>{m.gameListHeading}</h1>
      {isSystemAdmin ? (
        <GameAdmin onUnauthenticated={onUnauthenticated} />
      ) : (
        <GamesDenied />
      )}
    </>
  );
}

function GamesDenied() {
  const m = useMessages();
  return (
    <Panel>
      <p>{m.gameListDenied}</p>
      <a href="/">{m.backToStart}</a>
    </Panel>
  );
}

const CHANGE_MESSAGE = {
  added: "gameAdded",
  changed: "gameChanged",
  removed: "gameRemoved",
} as const satisfies Record<GameChange, string>;

/** Focus moves to the status message once a change has gone through, because the form or dialog that held it is gone. */
function GameAdmin({ onUnauthenticated }: { onUnauthenticated: () => void }) {
  const m = useMessages();
  const { state: games, reload } = useGames(onUnauthenticated);
  const {
    state: change,
    add,
    replace,
    remove,
  } = useGameChanges(reload, onUnauthenticated);
  const [editingId, setEditingId] = useState<string>();
  const [removing, setRemoving] = useState<Game>();
  const statusRef = useRef<HTMLParagraphElement>(null);
  const busy = change.status === "saving";

  if (games.status === "error" && games.code === NOT_ALLOWED)
    return <GamesDenied />;

  /** Closes what held the change, then moves focus. Returns the failure code so the form or dialog can show it. */
  function finished(code: string | undefined): string | undefined {
    if (code === undefined) {
      flushSync(() => {
        setEditingId(undefined);
        setRemoving(undefined);
      });
      statusRef.current?.focus();
    }
    return code;
  }

  return (
    <div className="panel-group">
      <Panel>
        <GameList
          state={games}
          editingId={editingId}
          busy={busy}
          onRetry={reload}
          onEdit={setEditingId}
          onSave={async (gameId: string, input: GameInput) =>
            finished(await replace(gameId, input))
          }
          onCancelEdit={() => setEditingId(undefined)}
          onRemove={setRemoving}
        />
        <p ref={statusRef} tabIndex={-1} role="status" className="status">
          {change.status === "done" && m[CHANGE_MESSAGE[change.change]]}
        </p>
        {change.status === "gone" && (
          <Alert>{toUserMessage(change.code)}</Alert>
        )}
      </Panel>
      <Panel>
        <h2>{m.gameAddHeading}</h2>
        <GameForm
          submitLabel={m.gameAddSubmit}
          busy={busy}
          onSubmit={async (input) => finished(await add(input))}
        />
      </Panel>
      {removing && (
        <DeleteGameDialog
          game={removing}
          busy={busy}
          onConfirm={async () => finished(await remove(removing.id))}
          onClose={() => setRemoving(undefined)}
        />
      )}
    </div>
  );
}
