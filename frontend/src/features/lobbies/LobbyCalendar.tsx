import { useEffect, useState } from "react";
import type { Lobby } from "../../api";
import { formatDayRange, useMessages } from "../../i18n";
import { Button, Icon, showToast } from "../../ui";
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
 * current week. A click on a future time opens the Create lobby form for it. A lobby just created (`createdId`)
 * is confirmed by a toast only when the reloaded list has it outside the week shown (REQ-0022).
 */
export function LobbyCalendar({
  groupId,
  lobbies,
  createdId,
  onCreatedSettled,
  onCreate,
}: {
  groupId: string;
  lobbies: Lobby[];
  createdId?: string;
  onCreatedSettled: () => void;
  onCreate: (start: PickedStart, button: HTMLElement) => void;
}) {
  const m = useMessages();
  const [weekStart, setWeekStart] = useState(() => weekStartOf(new Date()));
  const week = weekItems(weekStart, lobbies);

  useEffect(() => {
    // The list from before the create lacks the lobby; wait for the reloaded one.
    const created = lobbies.find((lobby) => lobby.id === createdId);
    if (!created) return;
    const shown = weekItems(weekStart, [created]).some(
      (day) => day.items.length > 0,
    );
    if (!shown) showToast(m.lobbyCreated);
    onCreatedSettled();
  }, [lobbies, createdId, weekStart, m, onCreatedSettled]);

  return (
    <div className="calendar">
      <div className="calendar__bar">
        <h3 aria-live="polite">
          {m.calendarWeekHeading(formatDayRange(week[0].day, week[6].day))}
        </h3>
        <Button
          type="button"
          variant="secondary"
          onClick={() => setWeekStart(nextWeekStart(weekStart))}
        >
          <Icon name="forward" />
          {m.calendarNextWeek}
        </Button>
      </div>
      <WeekTimeGrid
        days={week}
        titleLevel={4}
        hrefOf={(lobby) => lobbyPath(groupId, lobby.id)}
        genreOf={(lobby) => lobby.gameGenre}
        onCreate={onCreate}
      />
    </div>
  );
}
