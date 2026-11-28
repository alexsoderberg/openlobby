import { useCallback, useState } from "react";
import { useApi, type GameGoals, type GameItem } from "../../api";
import { loadViewOf, useChangeAction, useLoad } from "../../hooks";

const byItemId = (a: GameItem, b: GameItem) => a.itemId - b.itemId;

/**
 * The caller's goals per game (ADR 0029). Adding and removing write at once, and the shown list changes from what
 * was sent, without a reload, so "Already in your goals" holds straight after an add.
 */
export function useGoals(onUnauthenticated: () => void) {
  const api = useApi();
  const load = useCallback(() => api.getGoals(), [api]);
  const { state, reload } = useLoad(load, onUnauthenticated);
  const { busy, run } = useChangeAction(onUnauthenticated);
  // The games after this view's own writes; undefined until the first write.
  const [written, setWritten] = useState<GameGoals[]>();
  const view = loadViewOf(state);
  const loaded = view.status === "loaded" ? view.value : [];

  const change = (gameId: string, update: (goals: GameItem[]) => GameItem[]) =>
    setWritten((games = loaded) =>
      games.map((game) =>
        game.gameId === gameId ? { ...game, goals: update(game.goals) } : game,
      ),
    );

  /** Resolves to the error code of a refusal, or undefined when the item is a goal. */
  async function add(gameId: string, item: GameItem) {
    const code = await run(() => api.addGoal(gameId, item.itemId));
    if (!code)
      change(gameId, (goals) =>
        goals.some((goal) => goal.itemId === item.itemId)
          ? goals
          : [...goals, item].sort(byItemId),
      );
    return code;
  }

  async function remove(gameId: string, itemId: number) {
    const code = await run(() => api.removeGoal(gameId, itemId));
    if (!code)
      change(gameId, (goals) => goals.filter((goal) => goal.itemId !== itemId));
    return code;
  }

  return {
    view,
    games: written ?? loaded,
    busy,
    add,
    remove,
    reload: () => {
      setWritten(undefined);
      reload();
    },
  };
}
