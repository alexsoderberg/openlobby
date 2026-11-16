import { useState, type RefObject } from "react";
import { flushSync } from "react-dom";
import type { Game, GameInput } from "../../api";
import { GAME_NOT_FOUND } from "./gameErrors";
import { useGameChanges } from "./useGameChanges";
import { useGames } from "./useGames";

/**
 * State of the game list page: the games, which one is being changed or removed, and the focus after a
 * change, which goes to `statusRef`. Each action resolves to the error code the form or dialog should show. A success closes
 * what held the change and moves focus to the status message. So does a vanished game: the page
 * shows that message itself, so the form or dialog does not show it a second time. An added game opens in its
 * form, because its images can be added only once it has an ID (ADR 0026).
 */
export function useGameAdmin(
  onUnauthenticated: () => void,
  statusRef: RefObject<HTMLElement | null>,
) {
  const { state: games, reload, refresh } = useGames(onUnauthenticated);
  const changes = useGameChanges(refresh, onUnauthenticated);
  const [editingId, setEditingId] = useState<string>();
  const [removing, setRemoving] = useState<Game>();

  function closeUnlessFailed(code: string | undefined): string | undefined {
    if (code !== undefined && code !== GAME_NOT_FOUND) return code;
    // The modal dialog makes the page inert, so the status takes focus only once the dialog is unmounted.
    flushSync(() => {
      setEditingId(undefined);
      setRemoving(undefined);
    });
    statusRef.current?.focus();
    return undefined;
  }

  return {
    games,
    reload,
    refresh,
    change: changes.state,
    busy: changes.state.status === "saving",
    editingId,
    setEditingId,
    removing,
    setRemoving,
    add: async (input: GameInput) => {
      let addedId: string | undefined;
      const code = closeUnlessFailed(
        await changes.add(input, (game) => (addedId = game.id)),
      );
      if (addedId !== undefined) setEditingId(addedId);
      return code;
    },
    save: async (gameId: string, input: GameInput) =>
      closeUnlessFailed(await changes.replace(gameId, input)),
    confirmRemove: async (gameId: string) =>
      closeUnlessFailed(await changes.remove(gameId)),
  };
}
