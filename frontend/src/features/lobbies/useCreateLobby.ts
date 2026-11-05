import { useApi, type ChangeResult, type CreateLobbyInput } from "../../api";
import { useChangeAction } from "../../hooks";

/**
 * Saves a lobby. `create` resolves to the error code of a failure, or undefined on success, after
 * `onCreated` has run.
 */
export function useCreateLobby(
  groupId: string,
  onCreated: () => void,
  onUnauthenticated: () => void,
) {
  const api = useApi();
  const { busy, run } = useChangeAction(onUnauthenticated);

  async function create(input: CreateLobbyInput): ChangeResult {
    const code = await run(() => api.createLobby(groupId, input));
    if (code !== undefined) return code;
    onCreated();
    return undefined;
  }

  return { busy, create };
}
