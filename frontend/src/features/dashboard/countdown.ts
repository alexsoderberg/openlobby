import type { Lobby } from "../../api";
import type { Messages } from "../../i18n";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function countdownText(m: Messages["dashboard"], remaining: number): string {
  if (remaining >= DAY)
    return m.countdownDays(
      Math.floor(remaining / DAY),
      Math.floor((remaining % DAY) / HOUR),
    );
  if (remaining >= HOUR)
    return m.countdownHours(
      Math.floor(remaining / HOUR),
      Math.floor((remaining % HOUR) / MINUTE),
    );
  if (remaining >= MINUTE)
    return m.countdownMinutes(Math.floor(remaining / MINUTE));
  return m.countdownSoon;
}

/** The countdown to the start, "Running" from the start, "Ended" from the end. Values round down. */
export function timingText(
  m: Messages["dashboard"],
  lobby: Pick<Lobby, "startsAt" | "endsAt">,
  now: number,
): string {
  if (now >= Date.parse(lobby.endsAt)) return m.ended;
  if (now >= Date.parse(lobby.startsAt)) return m.running;
  return countdownText(m, Date.parse(lobby.startsAt) - now);
}
