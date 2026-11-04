import { GAMES_PATH } from "../features/games";
import { groupIdFromPath } from "../features/groups";

export type Route =
  | { name: "start" }
  | { name: "invite"; token: string }
  | { name: "group"; groupId: string }
  | { name: "games" }
  | { name: "notFound" };

const INVITE_PATH = /^\/invite\/([^/]+)$/;

export function routeFor(pathname: string): Route {
  if (pathname === "/") return { name: "start" };
  if (pathname === GAMES_PATH) return { name: "games" };
  const token = INVITE_PATH.exec(pathname)?.[1];
  if (token !== undefined) return { name: "invite", token };
  const groupId = groupIdFromPath(pathname);
  return groupId === undefined
    ? { name: "notFound" }
    : { name: "group", groupId };
}
