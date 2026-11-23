import { useEffect, useState } from "react";
import type { Lobby } from "../../api";
import { useNow } from "../../hooks";
import { formatDayRange, useMessages } from "../../i18n";
import {
  nextWeekStart,
  RunningOrder,
  weekItems,
  weekStartOf,
  type CreateOn,
} from "../../runningOrder";
import { Button, Icon, showToast } from "../../ui";
import { lobbyPath } from "./lobbyPath";

/** The Now line and the time that can still be picked move on each minute. */
const CLOCK_REFRESH_MS = 60_000;

/**
 * The lobbies of one Monday-to-Sunday week, starting with the current one, as a running order in the group's
 * colour. The only way on is the next week; there is no way back (REQ-0004). Leaving the calendar and coming back
 * starts at the current week. A future day's Create lobby button, or a click on its future time, opens the Create
 * lobby form for it. A lobby just created (`createdId`) is confirmed by a toast only when the reloaded list has it
 * outside the week shown (REQ-0022).
 */
export function LobbyCalendar({
  groupId,
  groupName,
  lobbies,
  createdId,
  onCreatedSettled,
  onCreate,
}: {
  groupId: string;
  groupName: string;
  lobbies: Lobby[];
  createdId?: string;
  onCreatedSettled: () => void;
  onCreate: CreateOn;
}) {
  const m = useMessages();
  const now = new Date(useNow(CLOCK_REFRESH_MS));
  const [weekStart, setWeekStart] = useState(() => weekStartOf(new Date()));
  const week = weekItems(
    weekStart,
    lobbies.map((lobby) => ({
      ...lobby,
      groupId,
      groupName,
      href: lobbyPath(groupId, lobby.id),
    })),
  );

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
    <RunningOrder
      heading={m.calendarWeekHeading(formatDayRange(week[0].day, week[6].day))}
      headingLevel={3}
      action={
        <Button
          type="button"
          variant="secondary"
          onClick={() => setWeekStart(nextWeekStart(weekStart))}
        >
          <Icon name="forward" />
          {m.calendarNextWeek}
        </Button>
      }
      days={week}
      now={now}
      onCreateOn={onCreate}
    />
  );
}
