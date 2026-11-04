// Formatting locale undefined: the browser's own, so dates and clock times read the way the user expects
// (ADR 0013, rule 7). The text locale is separate and stays English.
type Moment = Date | string;

const FORMATS = {
  dateTime: {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  },
  time: { hour: "numeric", minute: "2-digit" },
  weekday: { weekday: "long", day: "numeric", month: "short" },
  day: { day: "numeric", month: "short" },
} satisfies Record<string, Intl.DateTimeFormatOptions>;

const formatter = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(undefined, options);
const dateTime = formatter(FORMATS.dateTime);
const time = formatter(FORMATS.time);
const weekday = formatter(FORMATS.weekday);
const day = formatter(FORMATS.day);

const asDate = (moment: Moment) => new Date(moment);

export const formatDateTime = (moment: Moment) =>
  dateTime.format(asDate(moment));
/** Start and end. The formatter leaves out what the two have in common, so the end date shows only when it differs. */
export const formatDateTimeRange = (start: Moment, end: Moment) =>
  dateTime.formatRange(asDate(start), asDate(end));
export const formatTime = (moment: Moment) => time.format(asDate(moment));
export const formatTimeRange = (start: Moment, end: Moment) =>
  time.formatRange(asDate(start), asDate(end));
/** A day with its weekday spelled out, e.g. a calendar row. */
export const formatWeekday = (moment: Moment) => weekday.format(asDate(moment));
export const formatDayRange = (start: Moment, end: Moment) =>
  day.formatRange(asDate(start), asDate(end));
