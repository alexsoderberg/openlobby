import type { Genre } from "../api";
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
  momentAt,
  roundDownToHalfHour,
  type Block,
} from "./gridGeometry";

/** A start picked on the grid: a moment with a time from a click, only that day (`timed` false) from the keyboard. */
export type PickedStart = { moment: Date; timed: boolean };
export type CreateAt = (start: PickedStart, element: HTMLElement) => void;
export type TitleLevel = 3 | 4;

/**
 * The start a click means: where on the clickable part of the day the pointer is, rounded down to the half
 * hour. A click from the keyboard has no position (`detail` 0), so it picks the day and no time.
 */
function startOfClick(
  day: Date,
  fromMinute: number,
  event: MouseEvent<HTMLElement>,
): PickedStart {
  if (event.detail === 0) return { moment: day, timed: false };
  const { top, height } = event.currentTarget.getBoundingClientRect();
  const offset = ((event.clientY - top) * (DAY_MINUTES - fromMinute)) / height;
  return {
    moment: momentAt(day, roundDownToHalfHour(fromMinute + offset)),
    timed: true,
  };
}

/**
 * One day column. When `onCreate` is given, a button fills the part of the column from now on (all of a
 * later day, none of a past one), so only that part reacts to the pointer.
 */
export function TimeGridDay<T extends GridLobby>({
  day,
  blocks,
  selected,
  isToday,
  now,
  titleLevel,
  hrefOf,
  genreOf,
  onCreate,
}: {
  day: Date;
  blocks: Block<T>[];
  selected: boolean;
  isToday: boolean;
  now: Date;
  titleLevel: TitleLevel;
  hrefOf: (lobby: T) => string;
  /** The genre to theme a lobby with, or null for the neutral theme. The calendar reads no lobby genre itself. */
  genreOf: (lobby: T) => Genre | null;
  onCreate?: CreateAt;
}) {
  const m = useMessages();
  const Title = `h${titleLevel}` as const;
  const fromMinute = onCreate && clickableFromMinute(day, now);
  return (
    <li className="time-grid__day" data-selected={selected || undefined}>
      <Title
        className="time-grid__title"
        aria-current={isToday ? "date" : undefined}
      >
        <span>
          {formatWeekdayShort(day)} <b>{formatDayOfMonth(day)}</b>
        </span>
        {blocks.length === 0 && <small>{m.calendarNothingBooked}</small>}
      </Title>
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
              genre={genreOf(block.item)}
            />
          ))}
        </ul>
      </div>
    </li>
  );
}
