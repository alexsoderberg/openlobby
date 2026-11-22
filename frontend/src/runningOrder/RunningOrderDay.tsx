import { useId, type CSSProperties } from "react";
import { groupColorIndex } from "../groupColor";
import { formatDate, formatWeekdayShort, useMessages } from "../i18n";
import {
  placeOf,
  RunningOrderBlock,
  type RunningOrderLobby,
} from "./RunningOrderBlock";
import { daySegments, nowPosition } from "./runningOrderLayout";
import { dayAfter } from "./week";

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

/**
 * One day of the running order: its heading, then a track with its lobbies as blocks. A day with no lobby is one
 * line with no axis, except today, which keeps its axis and Now line. The bars and the Now line are drawn for the
 * eye only; the links carry the lobbies.
 */
export function RunningOrderDay({
  day,
  lobbies,
  now,
}: {
  day: Date;
  lobbies: RunningOrderLobby[];
  now: Date;
}) {
  const m = useMessages();
  const headingId = useId();
  const today = sameDay(day, now);
  const { segments, lanes } = daySegments(day, lobbies);
  const date = formatDate(day);
  // An empty day other than today is one line with no axis.
  const compact = segments.length === 0 && !today;
  const nothingBooked = (
    <p className="running-order__empty">{m.runningOrder.nothingBooked}</p>
  );
  return (
    <div
      role="group"
      aria-labelledby={headingId}
      className="running-order__day"
      data-past={dayAfter(day) <= now || undefined}
      data-empty={compact || undefined}
    >
      <h3
        id={headingId}
        className="running-order__name"
        aria-current={today ? "date" : undefined}
      >
        <span className="running-order__weekday">
          {formatWeekdayShort(day)}
        </span>{" "}
        <span className="running-order__date">
          {today ? m.runningOrder.today(date) : date}
        </span>
      </h3>
      {compact ? (
        nothingBooked
      ) : (
        <div
          className="running-order__track"
          style={{ "--lanes": lanes } as CSSProperties}
        >
          {segments.length === 0 ? (
            nothingBooked
          ) : (
            <ol className="running-order__lobbies">
              {segments.map((segment) => (
                <RunningOrderBlock key={segment.lobby.id} segment={segment} />
              ))}
            </ol>
          )}
          <div className="running-order__bars" aria-hidden="true">
            {segments.map((segment) => (
              <span
                key={segment.lobby.id}
                className="running-order__bar"
                style={placeOf(segment)}
                data-group-color={groupColorIndex(segment.lobby.groupId)}
                data-mine={segment.lobby.joinedByMe || undefined}
              />
            ))}
            {today && (
              <span
                className="running-order__now"
                style={{ "--now": nowPosition(now) } as CSSProperties}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
