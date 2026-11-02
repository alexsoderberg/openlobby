export type Route = "start" | "invite" | "notFound";

const INVITE_PATH = /^\/invite\/[^/]+$/;

export function routeFor(pathname: string): Route {
  if (pathname === "/") return "start";
  return INVITE_PATH.test(pathname) ? "invite" : "notFound";
}
