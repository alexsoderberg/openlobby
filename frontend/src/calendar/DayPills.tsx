import { formatDayOfMonth, formatWeekdayShort, useMessages } from "../i18n";
import type { Span, WeekDay } from "./week";

/** Phones: seven day buttons. A dot, and text for screen readers, marks a day with lobbies. */
export function DayPills({
  days,
  selected,
  todayIndex,
  onSelect,
}: {
  days: WeekDay<Span>[];
  selected: number;
  todayIndex: number;
  onSelect: (index: number) => void;
}) {
  const m = useMessages();
  return (
    <div
      className="day-pills"
      role="group"
      aria-label={m.calendarDayPillsLabel}
    >
      {days.map(({ day, items }, index) => (
        <button
          key={day.getTime()}
          type="button"
          className="day-pill"
          aria-pressed={index === selected}
          aria-current={index === todayIndex ? "date" : undefined}
          onClick={() => onSelect(index)}
        >
          <span>{formatWeekdayShort(day)}</span>
          <b>{formatDayOfMonth(day)}</b>
          {items.length > 0 && (
            <>
              <i className="day-pill__dot" aria-hidden="true" />
              <span className="visually-hidden">{m.calendarDayHasLobbies}</span>
            </>
          )}
        </button>
      ))}
    </div>
  );
}
