import { en, type Messages } from "./messages/en";

export {
  formatDateTime,
  formatDateTimeRange,
  formatDayOfMonth,
  formatDayRange,
  formatMediumDateTime,
  formatTime,
  formatTimeRange,
  formatWeekday,
  formatWeekdayShort,
} from "./format";
export type { Messages };
export type LoginErrorCode = keyof Messages["loginErrors"];

/** Components read texts through this hook, so a locale switch changes only this module. */
export function useMessages(): Messages {
  return en;
}

/** Maps a contract error code to user text. Unknown codes get the generic text (ADR 0013). */
export function toUserMessage(code: string): string {
  const errors: Record<string, string> = en.errors;
  return Object.hasOwn(errors, code) ? errors[code] : en.genericError;
}

export function isLoginErrorCode(value: string): value is LoginErrorCode {
  return Object.hasOwn(en.loginErrors, value);
}
