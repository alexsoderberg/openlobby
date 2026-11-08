import type { Genre } from "../api";
import { useEffect, useRef, useState } from "react";
import { formatTime, useMessages } from "../i18n";
import type { GridLobby } from "./TimeBlock";
import { TimeGridDay, type CreateAt, type TitleLevel } from "./TimeGridDay";
import { DAY_MINUTES, dayBlocks, initialScrollMinute } from "./gridGeometry";
import type { WeekDay } from "./week";

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
// The date is arbitrary: only the clock time is shown.
const hourLabel = (hour: number) => formatTime(new Date(2000, 0, 1, hour));

/**
 * Days as columns and the hours 00 to 24 down the side, in a fixed-height area that scrolls. It opens
 * scrolled to the afternoon, or to the earliest lobby shown if that is earlier. On phones CSS shows
 * only the selected day. The opening scroll is set once; later day or data changes keep the user's scroll.
 */
export function TimeGrid<T extends GridLobby>({
  days,
  selected,
  todayIndex,
  now,
  titleLevel,
  hrefOf,
  genreOf,
  onCreate,
}: {
  days: WeekDay<T>[];
  selected: number;
  todayIndex: number;
  now: Date;
  titleLevel: TitleLevel;
  hrefOf: (lobby: T) => string;
  /** The genre to theme a lobby with, or null for the neutral theme. The calendar reads no lobby genre itself. */
  genreOf: (lobby: T) => Genre | null;
  onCreate?: CreateAt;
}) {
  const m = useMessages();
  const scrollRef = useRef<HTMLDivElement>(null);
  const hoursRef = useRef<HTMLOListElement>(null);
  const daysRef = useRef<HTMLOListElement>(null);
  const columns = days.map(({ day, items }) => dayBlocks(day, items));
  const [opening] = useState(() => ({
    week: initialScrollMinute(columns.flat()),
    day: initialScrollMinute(columns[selected]),
  }));

  useEffect(() => {
    const scroll = scrollRef.current;
    const hours = hoursRef.current;
    const dayList = daysRef.current;
    if (!scroll || !hours || !dayList) return;
    // CSS hides the other days on phones; then the opening follows the one day shown.
    const oneDay = [...dayList.children].some(
      (column) => getComputedStyle(column).display === "none",
    );
    const minute = oneDay ? opening.day : opening.week;
    scroll.scrollTop = (hours.offsetHeight * minute) / DAY_MINUTES;
  }, [opening]);

  return (
    <div
      ref={scrollRef}
      className="time-grid"
      role="region"
      aria-label={m.calendarGridLabel}
      tabIndex={0}
    >
      <ol ref={hoursRef} className="time-grid__hours" aria-hidden="true">
        {HOURS.map((hour) => (
          <li key={hour}>{hourLabel(hour)}</li>
        ))}
      </ol>
      <ol ref={daysRef} className="time-grid__days" role="list">
        {days.map(({ day }, index) => (
          <TimeGridDay
            key={day.getTime()}
            day={day}
            blocks={columns[index]}
            selected={index === selected}
            isToday={index === todayIndex}
            now={now}
            titleLevel={titleLevel}
            hrefOf={hrefOf}
            genreOf={genreOf}
            onCreate={onCreate}
          />
        ))}
      </ol>
    </div>
  );
}
