import { useState } from "react";
import type { Lobby } from "../../api";
import { formatDayRange, useMessages } from "../../i18n";
import {
  nextWeekStart,
  weekItems,
  weekStartOf,
  type PickedStart,
  WeekTimeGrid,
} from "../../calendar";
import { lobbyPath } from "./lobbyPath";

/**
 * The lobbies of one Monday-to-Sunday week, starting with the current one, as a time grid. The only way
 * on is the next week; there is no way back (REQ-0004). Leaving the calendar and coming back starts at the
 * current week. A click on a future time opens the Create lobby form for it.
 */
export function LobbyCalendar({
  groupId,
  lobbies,
  onCreate,
}: {
  groupId: string;
  lobbies: Lobby[];
  onCreate: (start: PickedStart, button: HTMLElement) => void;
}) {
  const m = useMessages();
  const [weekStart, setWeekStart] = useState(() => weekStartOf(new Date()));
  const week = weekItems(weekStart, lobbies);

  return (
    <div className="calendar">
      <div className="calendar__bar">
        <h3 aria-live="polite">
          {m.calendarWeekHeading(formatDayRange(week[0].day, week[6].day))}
        </h3>
        <button
          type="button"
          className="button button--secondary"
          onClick={() => setWeekStart(nextWeekStart(weekStart))}
        >
          {m.calendarNextWeek}
        </button>
      </div>
      <WeekTimeGrid
        key={weekStart.getTime()}
        days={week}
        now={new Date()}
        titleLevel={4}
        hrefOf={(lobby) => lobbyPath(groupId, lobby.id)}
        onCreate={onCreate}
      />
    </div>
  );
}
