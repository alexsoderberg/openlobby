import { useId, useRef, type CSSProperties, type MouseEvent } from "react";
import { groupColorIndex } from "../groupColor";
import {
  formatDate,
  formatWeekday,
  formatWeekdayShort,
  useMessages,
} from "../i18n";
import { Button, Icon } from "../ui";
import {
  placeOf,
  RunningOrderBlock,
  type RunningOrderLobby,
} from "./RunningOrderBlock";
import {
  createWindow,
  DAY_MINUTES,
  daySegments,
  momentAt,
  nowPosition,
  pointerStartMinute,
} from "./runningOrderLayout";
import { dayAfter } from "./week";

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

/** The start under the pointer on a day's create area, which runs from minute `from` to midnight. */
function pointerStart(event: MouseEvent<HTMLElement>, day: Date, from: number) {
  const box = event.currentTarget.getBoundingClientRect();
  return momentAt(
    day,
    pointerStartMinute((event.clientX - box.left) / box.width, from),
  );
}

/** Opens the Create lobby form at a start; `origin` is the day's Create lobby button, where focus returns. */
export type CreateOn = (start: Date, origin: HTMLElement) => void;

/**
 * One day of the running order: its heading, then a track with its lobbies as blocks. A day with no lobby is one
 * line with no axis, except today and, when lobbies can be created, any later day: they keep their axis. The bars
 * and the Now line are drawn for the eye only; the links carry the lobbies. With `onCreate` a day that still has
 * time left gets a Create lobby button (the keyboard route) and a pointer area over its future time.
 */
export function RunningOrderDay({
  day,
  lobbies,
  now,
  headingLevel,
  onCreate,
}: {
  day: Date;
  lobbies: RunningOrderLobby[];
  now: Date;
  headingLevel: 3 | 4;
  onCreate?: CreateOn;
}) {
  const m = useMessages();
  const headingId = useId();
  const createButton = useRef<HTMLButtonElement>(null);
  const Heading = `h${headingLevel}` as const;
  const today = sameDay(day, now);
  const { segments, lanes } = daySegments(day, lobbies);
  const creatable = onCreate && createWindow(day, now);
  const date = formatDate(day);
  // An empty day with no axis to keep is one line.
  const compact = segments.length === 0 && !today && !creatable;
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
      <div className="running-order__name">
        <Heading
          id={headingId}
          className="running-order__heading"
          aria-current={today ? "date" : undefined}
        >
          <span className="running-order__weekday">
            {formatWeekdayShort(day)}
          </span>{" "}
          <span className="running-order__date">
            {today ? m.runningOrder.today(date) : date}
          </span>
        </Heading>
        {creatable && onCreate && (
          <Button
            ref={createButton}
            type="button"
            variant="ghost"
            aria-label={m.runningOrder.createOn(formatWeekday(day))}
            onClick={(event) =>
              onCreate(momentAt(day, creatable.start), event.currentTarget)
            }
          >
            <Icon name="plus" />
            {m.lobbyCreateButton}
          </Button>
        )}
      </div>
      {compact ? (
        nothingBooked
      ) : (
        <div
          className="running-order__track"
          style={{ "--lanes": lanes } as CSSProperties}
        >
          {creatable && onCreate && (
            // The pointer route to a start: hidden and out of the Tab order, because the button above is the
            // keyboard's. It covers the future time only, under the blocks, which take their own clicks.
            <div
              className="running-order__create"
              aria-hidden="true"
              style={
                { "--from": creatable.from / DAY_MINUTES } as CSSProperties
              }
              onClick={(event) => {
                // The button renders with this area, so it is always there; focus returns to it.
                if (createButton.current)
                  onCreate(
                    pointerStart(event, day, creatable.from),
                    createButton.current,
                  );
              }}
            />
          )}
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
