import { useState } from "react";
import { DayPills } from "./DayPills";
import { TimeGrid } from "./TimeGrid";
import type { GridLobby } from "./TimeBlock";
import type { CreateAt, TitleLevel } from "./TimeGridDay";
import type { WeekDay } from "./week";

/**
 * A week as a time grid: all seven days on wide screens, one day at a time with Day pills on phones
 * (CSS decides which, so the width is known in one place). The day starts on today, or Monday for another
 * week; remount with a new `key` per week. Without `onCreate` the grid cannot create lobbies.
 */
export function WeekTimeGrid<T extends GridLobby>({
  days,
  now,
  titleLevel,
  hrefOf,
  onCreate,
}: {
  days: WeekDay<T>[];
  /** The time that decides which day is today. */
  now: Date;
  /** Heading level of the day titles, one below the heading of the section the grid sits in. */
  titleLevel: TitleLevel;
  hrefOf: (lobby: T) => string;
  onCreate?: CreateAt;
}) {
  const today = now.toDateString();
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
      <TimeGrid
        days={days}
        selected={selected}
        todayIndex={todayIndex}
        now={now}
        titleLevel={titleLevel}
        hrefOf={hrefOf}
        onCreate={onCreate}
      />
    </>
  );
}
