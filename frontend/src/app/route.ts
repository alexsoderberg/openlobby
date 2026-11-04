import { GAMES_PATH } from "../features/games";
import { GROUPS_PATH, groupIdFromPath } from "../features/groups";
import { lobbyIdsFromPath } from "../features/lobbies";
import { PROFILE_PATH } from "../features/profile";

/** `start` is the address "/": the landing page when logged out, the Dashboard when logged in. */
export type Route =
  | { name: "start" }
  | { name: "invite"; token: string }
  | { name: "groups" }
  | { name: "group"; groupId: string }
  | { name: "lobby"; groupId: string; lobbyId: string }
  | { name: "profile" }
  | { name: "games" }
  | { name: "notFound" };

const INVITE_PATH = /^\/invite\/([^/]+)$/;

export function routeFor(pathname: string): Route {
  if (pathname === "/") return { name: "start" };
  if (pathname === GROUPS_PATH) return { name: "groups" };
  if (pathname === PROFILE_PATH) return { name: "profile" };
  if (pathname === GAMES_PATH) return { name: "games" };
  const token = INVITE_PATH.exec(pathname)?.[1];
  if (token !== undefined) return { name: "invite", token };
  const lobby = lobbyIdsFromPath(pathname);
  if (lobby) return { name: "lobby", ...lobby };
  const groupId = groupIdFromPath(pathname);
  return groupId === undefined
    ? { name: "notFound" }
    : { name: "group", groupId };
}
