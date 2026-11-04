import { useState } from "react";
import type { Lobby } from "../../api";
import { useMessages } from "../../i18n";
import { CalendarDay } from "./CalendarDay";
import { calendarWeek, nextWeekStart, weekStartOf } from "./calendarWeek";
import { formatWeek } from "./lobbyFormat";

/**
 * The lobbies of one Monday-to-Sunday week, starting with the current one. The only way on is the next
 * week; there is no way back (REQ-0004). Leaving the calendar and coming back starts at the current week.
 */
export function LobbyCalendar({
  groupId,
  lobbies,
}: {
  groupId: string;
  lobbies: Lobby[];
}) {
  const m = useMessages();
  const [weekStart, setWeekStart] = useState(() => weekStartOf(new Date()));
  const week = calendarWeek(weekStart, lobbies);

  return (
    <div className="calendar">
      <div className="calendar__bar">
        <h3 aria-live="polite">
          {m.calendarWeekHeading(formatWeek(week.map(({ day }) => day)))}
        </h3>
        <button
          type="button"
          className="button button--secondary"
          onClick={() => setWeekStart(nextWeekStart(weekStart))}
        >
          {m.calendarNextWeek}
        </button>
      </div>
      <ol className="row-list" role="list">
        {week.map((entry) => (
          <CalendarDay key={entry.day.getTime()} groupId={groupId} {...entry} />
        ))}
      </ol>
    </div>
  );
}
