import { WeekTimeGrid } from "../../calendar";
import { useStoredChoice } from "../../hooks";
import { useMessages } from "../../i18n";
import { CalendarIcon, ListIcon, ViewToggle } from "../../ui";
import { lobbyPath } from "../lobbies";
import { thisWeekOf, type DashboardLobby } from "./dashboardLobby";
import { DayList } from "./DayList";

type ThisWeekView = "calendar" | "days";
const THIS_WEEK_VIEWS: readonly ThisWeekView[] = ["calendar", "days"];

/** Per browser, not per account, so it survives log out. */
const VIEW_STORAGE_KEY = "openlobby.thisWeekView";

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
  const [view, setView] = useStoredChoice(
    VIEW_STORAGE_KEY,
    THIS_WEEK_VIEWS,
    "calendar",
  );
  const days = thisWeekOf(lobbies, now);
  return (
    <section aria-labelledby="this-week-heading">
      <h2 id="this-week-heading">{m.dashboard.thisWeekHeading}</h2>
      <ViewToggle
        label={m.dashboard.viewLabel}
        value={view}
        options={[
          {
            value: "calendar",
            label: m.dashboard.viewCalendar,
            icon: <CalendarIcon />,
          },
          { value: "days", label: m.dashboard.viewDays, icon: <ListIcon /> },
        ]}
        onChange={setView}
      />
      {view === "days" ? (
        <DayList days={days} />
      ) : (
        <WeekTimeGrid
          days={days}
          now={new Date(now)}
          titleLevel={3}
          hrefOf={(lobby) => lobbyPath(lobby.groupId, lobby.id)}
          genreOf={(lobby) => lobby.gameGenre}
        />
      )}
    </section>
  );
}
