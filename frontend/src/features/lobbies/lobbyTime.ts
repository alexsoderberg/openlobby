import {
  LOBBY_END_NOT_AFTER_START,
  LOBBY_IN_PAST,
  LOBBY_TIME_MISSING,
} from "./lobbyErrors";

const DATE_TEXT = /^(\d{4})-(\d{2})-(\d{2})$/;
const SUGGESTED_HOURS = 2;
const pad = (value: number) => String(value).padStart(2, "0");
const CLOCK_TEXT = /^(\d{2}):(\d{2})$/;

export type LobbyTimesResult =
  { ok: true; startsAt: string; endsAt: string } | { ok: false; code: string };

/** Local time of a date and a clock time as typed, or undefined for an empty or impossible value. */
function localMoment(dateText: string, clockText: string): Date | undefined {
  const date = DATE_TEXT.exec(dateText);
  const clock = CLOCK_TEXT.exec(clockText);
  if (!date || !clock) return undefined;
  const [year, month, day, hour, minute] = [
    ...date.slice(1),
    ...clock.slice(1),
  ].map(Number);
  const moment = new Date(year, month - 1, day, hour, minute);
  // new Date rolls 31 February over to March; a rolled date is not what the user typed.
  return moment.getMonth() === month - 1 && moment.getDate() === day
    ? moment
    : undefined;
}

/**
 * Turns the user's local date and clock times into the two moments the API takes. An end clock time
 * earlier than the start is the next day. Quick feedback only: the server applies the same rules.
 */
export function lobbyTimesFrom(
  dateText: string,
  startText: string,
  endText: string,
  now: Date,
): LobbyTimesResult {
  const start = localMoment(dateText, startText);
  const end = localMoment(dateText, endText);
  if (!start || !end) return { ok: false, code: LOBBY_TIME_MISSING };
  if (end.getTime() === start.getTime())
    return { ok: false, code: LOBBY_END_NOT_AFTER_START };
  if (end < start) end.setDate(end.getDate() + 1);
  if (start < now) return { ok: false, code: LOBBY_IN_PAST };
  return { ok: true, startsAt: start.toISOString(), endsAt: end.toISOString() };
}

/** The end suggested for a start picked on the calendar: two hours later, which may be on the next day. */
export function suggestedEnd(start: Date): Date {
  return new Date(start.getTime() + SUGGESTED_HOURS * 60 * 60 * 1000);
}

/** The HH:MM text of a moment in the viewer's time zone, the value a time field takes. */
export function localClockText(moment: Date): string {
  return `${pad(moment.getHours())}:${pad(moment.getMinutes())}`;
}

/** The YYYY-MM-DD text of a date in the viewer's time zone, the value a date field takes. */
export function localDateText(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Whether the end time has passed. */
export function hasEnded({ endsAt }: { endsAt: string }): boolean {
  return Date.parse(endsAt) <= Date.now();
}
