import { useEffect, useRef } from "react";
import { formatTime, useMessages } from "../i18n";
import type { GridLobby } from "./TimeBlock";
import { TimeGridDay, type CreateAt, type TitleLevel } from "./TimeGridDay";
import { DAY_MINUTES, dayBlocks, initialScrollMinute } from "./gridGeometry";
import type { WeekDay } from "./week";

// Must match the phone breakpoint in global.css, where only the selected day shows.
const PHONE_QUERY = "(max-width: 47.499rem)";
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
// The date is arbitrary: only the clock time is shown.
const hourLabel = (hour: number) => formatTime(new Date(2000, 0, 1, hour));

/**
 * Days as columns and the hours 00 to 24 down the side, in a fixed-height area that scrolls. It opens
 * scrolled to the afternoon, or to the earliest lobby shown if that is earlier. On phones CSS shows
 * only the selected day.
 */
export function TimeGrid<T extends GridLobby>({
  days,
  selected,
  todayIndex,
  titleLevel,
  hrefOf,
  onCreate,
}: {
  days: WeekDay<T>[];
  selected: number;
  todayIndex: number;
  titleLevel: TitleLevel;
  hrefOf: (lobby: T) => string;
  onCreate?: CreateAt;
}) {
  const m = useMessages();
  const scrollRef = useRef<HTMLDivElement>(null);
  const hoursRef = useRef<HTMLOListElement>(null);
  const columns = days.map(({ day, items }) => dayBlocks(day, items));
  // Phones show one day, so the scroll follows it; wider screens show the whole week.
  const narrow = window.matchMedia(PHONE_QUERY).matches;
  const scrollMinute = initialScrollMinute(
    (narrow ? [columns[selected]] : columns).flat(),
  );

  useEffect(() => {
    const scroll = scrollRef.current;
    const hours = hoursRef.current;
    if (scroll && hours)
      scroll.scrollTop = (hours.offsetHeight * scrollMinute) / DAY_MINUTES;
  }, [scrollMinute]);

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
      <ol className="time-grid__days" role="list">
        {days.map(({ day }, index) => (
          <TimeGridDay
            key={day.getTime()}
            day={day}
            blocks={columns[index]}
            selected={index === selected}
            isToday={index === todayIndex}
            titleLevel={titleLevel}
            hrefOf={hrefOf}
            onCreate={onCreate}
          />
        ))}
      </ol>
    </div>
  );
}
