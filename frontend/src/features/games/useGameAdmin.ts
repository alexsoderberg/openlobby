import { useState, type RefObject } from "react";
import type { Game, GameInput } from "../../api";
import { GAME_NOT_FOUND } from "./gameErrors";
import { useGameChanges, type GameChange } from "./useGameChanges";
import { useGames } from "./useGames";

/**
 * State of the game list page: the games, which one is being changed or removed, and the focus after a
 * change, which goes to `focusRef`. Each action resolves to the error code the form or dialog should show. A success closes
 * what held the change, moves focus to `focusRef` and is handed to `onDone`; a saved game's form stays open instead, with
 * the saved game, so that the drop list of a new activity can be filled at once (ADR 0029 section 6). A vanished game closes and moves focus
 * too: the page shows that message itself, so the form or dialog does not show it a second time. An added game
 * opens in its form, because its images can be added only once it has an ID (ADR 0026).
 */
export function useGameAdmin(
  onUnauthenticated: () => void,
  focusRef: RefObject<HTMLElement | null>,
  onDone: (change: GameChange) => void,
) {
  const { state: games, reload, refresh } = useGames(onUnauthenticated);
  const changes = useGameChanges(refresh, onUnauthenticated);
  const [editingId, setEditingId] = useState<string>();
  const [removing, setRemoving] = useState<Game>();

  function closeUnlessFailed(
    change: GameChange,
    code: string | undefined,
  ): string | undefined {
    if (code !== undefined && code !== GAME_NOT_FOUND) return code;
    setEditingId(undefined);
    focusRef.current?.focus();
    if (code === undefined) onDone(change);
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
    /** After the confirm dialog's exit, so that its scrim no longer hides the toast; a vanished game only moves focus. */
    closeRemove: (removed: boolean) => {
      setRemoving(undefined);
      if (!removed) return;
      focusRef.current?.focus();
      if (changes.state.status === "done") onDone("removed");
    },
    add: async (input: GameInput) => {
      let addedId: string | undefined;
      const code = closeUnlessFailed(
        "added",
        await changes.add(input, (game) => (addedId = game.id)),
      );
      if (addedId !== undefined) setEditingId(addedId);
      return code;
    },
    save: async (
      gameId: string,
      input: GameInput,
      onSaved: (game: Game) => void,
    ) => {
      const code = await changes.replace(gameId, input, onSaved);
      if (code === GAME_NOT_FOUND) return closeUnlessFailed("changed", code);
      if (code === undefined) onDone("changed");
      return code;
    },
    // A vanished game closes the dialog too: the page shows that message itself.
    confirmRemove: async (gameId: string) => {
      const code = await changes.remove(gameId);
      return code === GAME_NOT_FOUND ? undefined : code;
    },
  };
}
