import type { WeekDay } from "../../calendar";
import { formatDayOfMonth, formatWeekdayShort, useMessages } from "../../i18n";
import type { DashboardLobby } from "./dashboardLobby";

/** Phones: seven day buttons. A dot, and text for screen readers, marks a day with lobbies. */
export function DayPills({
  days,
  selected,
  todayIndex,
  onSelect,
}: {
  days: WeekDay<DashboardLobby>[];
  selected: number;
  todayIndex: number;
  onSelect: (index: number) => void;
}) {
  const m = useMessages();
  return (
    <div
      className="day-pills"
      role="group"
      aria-label={m.dashboard.dayPillsLabel}
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
              <span className="visually-hidden">
                {m.dashboard.dayHasLobbies}
              </span>
            </>
          )}
        </button>
      ))}
    </div>
  );
}
