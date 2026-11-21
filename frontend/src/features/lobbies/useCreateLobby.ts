import {
  useApi,
  type ChangeResult,
  type CreateLobbyInput,
  type Lobby,
} from "../../api";
import { useChangeAction } from "../../hooks";

/**
 * Saves a lobby. `create` resolves to the error code of a failure, or undefined on success, after
 * `onCreated` has run with the saved lobby.
 */
export function useCreateLobby(
  groupId: string,
  onCreated: (lobby: Lobby) => void,
  onUnauthenticated: () => void,
) {
  const api = useApi();
  const { busy, run } = useChangeAction(onUnauthenticated);

  async function create(input: CreateLobbyInput): ChangeResult {
    let created: Lobby | undefined;
    const code = await run(async () => {
      created = await api.createLobby(groupId, input);
    });
    if (created === undefined) return code;
    onCreated(created);
    return undefined;
  }

  return { busy, create };
}
