import type { CSSProperties, MouseEvent } from "react";
import {
  formatDayOfMonth,
  formatWeekday,
  formatWeekdayShort,
  useMessages,
} from "../i18n";
import { TimeBlock, type GridLobby } from "./TimeBlock";
import {
  DAY_MINUTES,
  clickableFromMinute,
  keyboardStartMinute,
  momentAt,
  roundDownToHalfHour,
  type Block,
} from "./gridGeometry";

export type CreateAt = (start: Date, element: HTMLElement) => void;

/**
 * The start a click means: where on the clickable part of the day the pointer is, rounded down to the half
 * hour. A click from the keyboard has no position (`detail` 0) and gets a fixed default.
 */
function startOfClick(
  day: Date,
  fromMinute: number,
  event: MouseEvent<HTMLElement>,
): Date {
  if (event.detail === 0) return momentAt(day, keyboardStartMinute(fromMinute));
  const { top, height } = event.currentTarget.getBoundingClientRect();
  const offset = ((event.clientY - top) * (DAY_MINUTES - fromMinute)) / height;
  return momentAt(day, roundDownToHalfHour(fromMinute + offset));
}

/**
 * One day column. When `onCreate` is given, a button fills the part of the column from now on (all of a
 * later day, none of a past one), so only that part reacts to the pointer. "Now" is read at render; the
 * column is redrawn whenever the week changes, which is often enough.
 */
export function TimeGridDay<T extends GridLobby>({
  day,
  blocks,
  selected,
  isToday,
  hrefOf,
  onCreate,
}: {
  day: Date;
  blocks: Block<T>[];
  selected: boolean;
  isToday: boolean;
  hrefOf: (lobby: T) => string;
  onCreate?: CreateAt;
}) {
  const m = useMessages();
  const fromMinute = onCreate && clickableFromMinute(day, new Date());
  return (
    <li className="time-grid__day" data-selected={selected || undefined}>
      <div
        className="time-grid__title"
        aria-current={isToday ? "date" : undefined}
      >
        <span>{formatWeekdayShort(day)}</span> <b>{formatDayOfMonth(day)}</b>
      </div>
      <div className="time-grid__track">
        {onCreate && fromMinute !== undefined && (
          <button
            type="button"
            className="time-grid__create"
            style={{ "--from": fromMinute } as CSSProperties}
            aria-label={m.calendarCreateOnDay(formatWeekday(day))}
            onClick={(event) =>
              onCreate(
                startOfClick(day, fromMinute, event),
                event.currentTarget,
              )
            }
          />
        )}
        <ul className="time-grid__blocks" role="list">
          {blocks.map((block) => (
            <TimeBlock
              key={block.item.id}
              block={block}
              href={hrefOf(block.item)}
            />
          ))}
        </ul>
      </div>
    </li>
  );
}
