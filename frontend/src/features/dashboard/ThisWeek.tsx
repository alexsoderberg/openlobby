import { WeekTimeGrid } from "../../calendar";
import { useMessages } from "../../i18n";
import { lobbyPath } from "../lobbies";
import { thisWeekOf, type DashboardLobby } from "./dashboardLobby";

/**
 * The current week across all groups as a time grid; each block names its group. `now` is the time of
 * loading. The dashboard only shows the week, so there is no way to create a lobby from it.
 */
export function ThisWeek({
  lobbies,
  now,
}: {
  lobbies: DashboardLobby[];
  now: number;
}) {
  const m = useMessages();
  return (
    <section aria-labelledby="this-week-heading">
      <h2 id="this-week-heading">{m.dashboard.thisWeekHeading}</h2>
      <WeekTimeGrid
        days={thisWeekOf(lobbies, now)}
        hrefOf={(lobby) => lobbyPath(lobby.groupId, lobby.id)}
      />
    </section>
  );
}
