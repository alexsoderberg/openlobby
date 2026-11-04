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
 * shows that message itself, so the form or dialog does not show it a second time.
 */
export function useGameAdmin(
  onUnauthenticated: () => void,
  statusRef: RefObject<HTMLElement | null>,
) {
  const { state: games, reload, refresh } = useGames(onUnauthenticated);
  const changes = useGameChanges(refresh, onUnauthenticated);
  const [editingId, setEditingId] = useState<string>();
  const [removing, setRemoving] = useState<Game>();

  function finished(code: string | undefined): string | undefined {
    if (code !== undefined && code !== GAME_NOT_FOUND) return code;
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
    change: changes.state,
    editingId,
    setEditingId,
    removing,
    setRemoving,
    add: async (input: GameInput) => finished(await changes.add(input)),
    save: async (gameId: string, input: GameInput) =>
      finished(await changes.replace(gameId, input)),
    confirmRemove: async (gameId: string) =>
      finished(await changes.remove(gameId)),
  };
}
