const GROUP_PREFIX = "/groups/";
const LOBBY_PATH = /^\/groups\/([^/]+)\/lobbies\/([^/]+)$/;

/** The address of a lobby's detail page. The router reads addresses back with lobbyIdsFromPath. */
export function lobbyPath(groupId: string, lobbyId: string): string {
  return `${GROUP_PREFIX}${groupId}/lobbies/${lobbyId}`;
}

/** The group and lobby ids in a lobby page address, or undefined for any other address. */
export function lobbyIdsFromPath(
  pathname: string,
): { groupId: string; lobbyId: string } | undefined {
  const match = LOBBY_PATH.exec(pathname);
  return match ? { groupId: match[1], lobbyId: match[2] } : undefined;
}
