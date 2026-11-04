import type { ActiveNav } from "../features/shell";
import type { Route } from "./route";

/** What the navigation marks for a page. The Game list is reached from the You page, so it marks You. */
export function activeNavOf(route: Route): ActiveNav {
  switch (route.name) {
    case "start":
      return { section: "home" };
    case "groups":
      return { section: "groups" };
    case "group":
    case "lobby":
      return { section: "groups", groupId: route.groupId };
    case "profile":
    case "games":
      return { section: "profile" };
    case "invite":
    case "notFound":
      return {};
  }
}
