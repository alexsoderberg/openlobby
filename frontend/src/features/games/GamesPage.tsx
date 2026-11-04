import { useRef, type RefObject } from "react";
import { toUserMessage, useMessages } from "../../i18n";
import { Alert, Panel } from "../../ui";
import { GROUPS_PATH } from "../groups";
import { DeleteGameDialog } from "./DeleteGameDialog";
import { GameForm } from "./GameForm";
import { GameList } from "./GameList";
import { NOT_ALLOWED } from "./gameErrors";
import type { GameChange } from "./useGameChanges";
import { useGameAdmin } from "./useGameAdmin";

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
  return isSystemAdmin ? (
    <GameAdmin onUnauthenticated={onUnauthenticated} />
  ) : (
    <GamesDenied />
  );
}

function GamesDenied() {
  const m = useMessages();
  return (
    <Panel>
      <p>{m.gameListDenied}</p>
      <a href={GROUPS_PATH}>{m.backToGroups}</a>
    </Panel>
  );
}

const CHANGE_MESSAGE = {
  added: "gameAdded",
  changed: "gameChanged",
  removed: "gameRemoved",
} as const satisfies Record<GameChange, string>;

type Admin = ReturnType<typeof useGameAdmin>;

function GameAdmin({ onUnauthenticated }: { onUnauthenticated: () => void }) {
  const m = useMessages();
  const statusRef = useRef<HTMLParagraphElement>(null);
  const admin = useGameAdmin(onUnauthenticated, statusRef);

  if (admin.games.status === "error" && admin.games.code === NOT_ALLOWED)
    return <GamesDenied />;

  return (
    <>
      <h1>{m.gameListHeading}</h1>
      <div className="panel-group">
        <GameListPanel admin={admin} statusRef={statusRef} />
        <Panel>
          <h2>{m.gameAddHeading}</h2>
          <GameForm
            submitLabel={m.gameAddSubmit}
            busy={admin.busy}
            onSubmit={admin.add}
          />
        </Panel>
        <RemoveGame admin={admin} />
      </div>
    </>
  );
}

/** The confirmation for the game being removed, if any. */
function RemoveGame({ admin }: { admin: Admin }) {
  const { removing } = admin;
  if (!removing) return null;
  return (
    <DeleteGameDialog
      game={removing}
      busy={admin.busy}
      onConfirm={() => admin.confirmRemove(removing.id)}
      onClose={() => admin.setRemoving(undefined)}
    />
  );
}

/** The list, then the status line that receives focus after a change, then a notice for a vanished game. */
function GameListPanel({
  admin,
  statusRef,
}: {
  admin: Admin;
  statusRef: RefObject<HTMLParagraphElement | null>;
}) {
  const m = useMessages();
  const { change } = admin;

  return (
    <Panel>
      <GameList
        state={admin.games}
        editingId={admin.editingId}
        busy={admin.busy}
        onRetry={admin.reload}
        onEdit={admin.setEditingId}
        onSave={admin.save}
        onCancelEdit={() => admin.setEditingId(undefined)}
        onRemove={admin.setRemoving}
      />
      <p ref={statusRef} tabIndex={-1} role="status" className="status">
        {change.status === "done" && m[CHANGE_MESSAGE[change.change]]}
      </p>
      {change.status === "gone" && <Alert>{toUserMessage(change.code)}</Alert>}
    </Panel>
  );
}
