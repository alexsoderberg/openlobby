import type { Genre } from "../api";
import { useState } from "react";
import { useNow } from "../hooks";
import { DayPills } from "./DayPills";
import { TimeGrid } from "./TimeGrid";
import type { GridLobby } from "./TimeBlock";
import type { CreateAt, TitleLevel } from "./TimeGridDay";
import type { WeekDay } from "./week";

const CLOCK_REFRESH_MS = 60_000;

/**
 * A week as a time grid: all seven days on wide screens, one day at a time with Day pills on phones
 * (CSS decides which, so the width is known in one place). The day starts on today, or Monday for another
 * week. The grid stays mounted across weeks, so it keeps its scroll (REQ-0019). Without `onCreate` the grid
 * cannot create lobbies.
 */
export function WeekTimeGrid<T extends GridLobby>({
  days,
  titleLevel,
  hrefOf,
  genreOf,
  onCreate,
}: {
  days: WeekDay<T>[];
  /** Heading level of the day titles, one below the heading of the section the grid sits in. */
  titleLevel: TitleLevel;
  hrefOf: (lobby: T) => string;
  /** The genre to theme a lobby with, or null for the neutral theme. The calendar reads no lobby genre itself. */
  genreOf: (lobby: T) => Genre | null;
  onCreate?: CreateAt;
}) {
  // The one clock of the grid: it decides today, the Now line and the times that can still be picked.
  const now = new Date(useNow(CLOCK_REFRESH_MS));
  const today = now.toDateString();
  const todayIndex = days.findIndex(({ day }) => day.toDateString() === today);
  const firstSelected = Math.max(todayIndex, 0);
  const [selected, setSelected] = useState(firstSelected);
  const weekStart = days[0].day.getTime();
  const [shownWeek, setShownWeek] = useState(weekStart);
  if (shownWeek !== weekStart) {
    setShownWeek(weekStart);
    setSelected(firstSelected);
  }

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
        genreOf={genreOf}
        onCreate={onCreate}
      />
    </>
  );
}
