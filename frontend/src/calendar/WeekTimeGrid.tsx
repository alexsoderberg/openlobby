import { useState } from "react";
import { useMessages } from "../i18n";
import { DayPills } from "./DayPills";
import { TimeGrid } from "./TimeGrid";
import type { GridLobby } from "./TimeBlock";
import type { CreateAt } from "./TimeGridDay";
import type { WeekDay } from "./week";

/**
 * A week as a time grid: all seven days on wide screens, one day at a time with Day pills on phones
 * (CSS decides which, so the width is known in one place). The day starts on today, or Monday for another
 * week; remount with a new `key` per week. Without `onCreate` the grid cannot create lobbies.
 */
export function WeekTimeGrid<T extends GridLobby>({
  days,
  hrefOf,
  onCreate,
}: {
  days: WeekDay<T>[];
  hrefOf: (lobby: T) => string;
  onCreate?: CreateAt;
}) {
  const m = useMessages();
  const today = new Date().toDateString();
  const todayIndex = days.findIndex(({ day }) => day.toDateString() === today);
  const [selected, setSelected] = useState(Math.max(todayIndex, 0));

  return (
    <>
      <DayPills
        days={days}
        selected={selected}
        todayIndex={todayIndex}
        onSelect={setSelected}
      />
      {days.every(({ items }) => items.length === 0) && (
        <p className="time-grid__empty">{m.calendarNoLobbiesInWeek}</p>
      )}
      <TimeGrid
        days={days}
        selected={selected}
        todayIndex={todayIndex}
        hrefOf={hrefOf}
        onCreate={onCreate}
      />
    </>
  );
}
