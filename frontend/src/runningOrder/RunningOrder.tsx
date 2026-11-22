import { useId, useLayoutEffect, useRef, useState } from "react";
import { formatHour, useMessages } from "../i18n";
import type { RunningOrderLobby } from "./RunningOrderBlock";
import { RunningOrderDay } from "./RunningOrderDay";
import { DAY_MINUTES, openingMinute } from "./runningOrderLayout";
import type { WeekDay } from "./week";

const HOURS_PER_DAY = 24;
/** The axis is labelled every other hour, 00 to 22. */
const HOURS_PER_LABEL = 2;
const LABELLED_HOURS = Array.from(
  { length: HOURS_PER_DAY / HOURS_PER_LABEL },
  (_, index) => index * HOURS_PER_LABEL,
);

/**
 * The week as a running order: one row per day from Monday to Sunday, time from left to right over 00:00 to 24:00,
 * each lobby a block of its real length in its group colour (ADR 0028 section 4). The component is the scroll
 * container: about 16 hours show on wide screens and about 6 on phones, and the rest of the axis scrolls sideways
 * inside it, never the page. On opening it scrolls once to a window that holds the lobbies (openingMinute).
 */
export function RunningOrder({
  heading,
  days,
  now,
}: {
  heading: string;
  days: WeekDay<RunningOrderLobby>[];
  now: Date;
}) {
  const m = useMessages();
  const headingId = useId();
  const scroller = useRef<HTMLDivElement>(null);
  const axis = useRef<HTMLDivElement>(null);
  // The lobbies and the time at opening: the opening scroll is decided once, later data keeps the position.
  const [atOpening] = useState(() => ({
    lobbies: days.flatMap(({ items }) => items),
    from: days[0].day,
    now,
  }));

  useLayoutEffect(() => {
    const view = scroller.current;
    const hours = axis.current;
    if (!view || !hours || hours.offsetWidth === 0) return;
    // The day names take the part of the view left of the axis on wide screens; on phones nothing does.
    const nameColumn = hours.parentElement!.offsetWidth - hours.offsetWidth;
    const visibleMinutes =
      ((view.clientWidth - nameColumn) / hours.offsetWidth) * DAY_MINUTES;
    const { lobbies, from, now: openedAt } = atOpening;
    view.scrollLeft =
      (hours.offsetWidth *
        openingMinute(lobbies, from, openedAt, visibleMinutes)) /
      DAY_MINUTES;
  }, [atOpening]);

  return (
    <section className="running-order" aria-labelledby={headingId}>
      <h2 id={headingId}>{heading}</h2>
      {/* signature: home. The running order track and its Now line (REQ-0029 item 13). */}
      <div
        ref={scroller}
        className="running-order__scroll"
        role="region"
        aria-label={m.runningOrder.scrollLabel}
        tabIndex={0}
      >
        {/* As wide as the axis, so the day names and the phone rows can stick to the left while it scrolls. */}
        <div className="running-order__week">
          <div className="running-order__scale" aria-hidden="true">
            <div ref={axis} className="running-order__hours">
              {LABELLED_HOURS.map((hour) => (
                <span key={hour}>
                  {/* Any day will do: only its hour is written. */}
                  {formatHour(new Date(2000, 0, 1, hour))}
                </span>
              ))}
            </div>
          </div>
          {days.map(({ day, items }) => (
            <RunningOrderDay
              key={day.getTime()}
              day={day}
              lobbies={items}
              now={now}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
