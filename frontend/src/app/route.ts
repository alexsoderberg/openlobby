import { groupIdFromPath } from "../features/groups";

export type Route =
  | { name: "start" }
  | { name: "invite" }
  | { name: "group"; groupId: string }
  | { name: "notFound" };

const INVITE_PATH = /^\/invite\/[^/]+$/;

export function routeFor(pathname: string): Route {
  if (pathname === "/") return { name: "start" };
  if (INVITE_PATH.test(pathname)) return { name: "invite" };
  const groupId = groupIdFromPath(pathname);
  return groupId === undefined
    ? { name: "notFound" }
    : { name: "group", groupId };
}
