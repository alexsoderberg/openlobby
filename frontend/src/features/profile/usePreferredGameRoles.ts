import { useCallback, useState } from "react";
import {
  INVALID_GAME_ROLE,
  useApi,
  type PreferredGameRoleChoices,
} from "../../api";
import { loadViewOf, useChangeAction, useLoad } from "../../hooks";

/** What the last save ended in: `code` is undefined when it was saved. A new object per save, so focus moves each time. */
export type SaveOutcome = { code?: string };

/**
 * Loads the caller's preferred game roles with the games to choose from, and saves a new choice. A game role
 * removed while the page was open gives `invalid_game_role`; the list then loads again (ADR 0022 point 4), and
 * `reloading` stays true until it has, so the stale ID cannot be sent again.
 */
export function usePreferredGameRoles(onUnauthenticated: () => void) {
  const api = useApi();
  const load = useCallback(() => api.getPreferredGameRoles(), [api]);
  const { state, reload, refresh } = useLoad(load, onUnauthenticated);
  const { busy, run } = useChangeAction(onUnauthenticated);
  const [outcome, setOutcome] = useState<SaveOutcome>();
  const [staleChoices, setStaleChoices] = useState<PreferredGameRoleChoices>();
  const loaded = state.status === "loaded" ? state.value : undefined;

  async function save(gameRoleIds: string[]) {
    const code = await run(() => api.replacePreferredGameRoles(gameRoleIds));
    setOutcome({ code });
    if (code === INVALID_GAME_ROLE) {
      setStaleChoices(loaded);
      refresh();
    }
  }

  return {
    choices: loadViewOf(state),
    // A fresh load starts a fresh form, so the last save's message and focus are not shown again.
    reload: () => {
      setOutcome(undefined);
      reload();
    },
    busy,
    reloading: loaded !== undefined && loaded === staleChoices,
    outcome,
    save,
  };
}
