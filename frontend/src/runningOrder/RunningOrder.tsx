import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { formatHour, useMessages } from "../i18n";
import type { RunningOrderLobby } from "./RunningOrderBlock";
import { RunningOrderDay, type CreateOn } from "./RunningOrderDay";
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
 * `onCreateOn` gives the future days a way to create a lobby (the Group view); without it there is none (Home).
 */
export function RunningOrder({
  heading,
  headingLevel = 2,
  action,
  days,
  now,
  onCreateOn,
}: {
  heading: string;
  /** The level of the heading, one below the heading of the section it sits in; the days are one below it. */
  headingLevel?: 2 | 3;
  /** A control beside the heading, such as the next week. */
  action?: ReactNode;
  days: WeekDay<RunningOrderLobby>[];
  now: Date;
  onCreateOn?: CreateOn;
}) {
  const Heading = `h${headingLevel}` as const;
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
    const row = hours?.parentElement;
    if (!view || !hours || !row || hours.offsetWidth === 0) return;
    // The day names take the part of the view left of the axis on wide screens; on phones nothing does.
    const nameColumn = row.offsetWidth - hours.offsetWidth;
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
      <div className="running-order__head">
        {/* Polite: the heading names the week, which the action may change. */}
        <Heading id={headingId} aria-live="polite">
          {heading}
        </Heading>
        {action}
      </div>
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
              headingLevel={headingLevel === 2 ? 3 : 4}
              onCreate={onCreateOn}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
