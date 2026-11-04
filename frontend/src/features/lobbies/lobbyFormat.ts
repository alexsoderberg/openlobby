import type { Lobby } from "../../api";

// Locale undefined: the user's own, so dates and clock times read the way they expect.
const DAY_AND_CLOCK = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});
const CLOCK = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
});
const DAY = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  day: "numeric",
  month: "short",
});
const SHORT_DAY = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "short",
});

/** Start and end with their dates. The formatter leaves out what the two have in common. */
export function formatLobbyWhen({ startsAt, endsAt }: Lobby): string {
  return DAY_AND_CLOCK.formatRange(new Date(startsAt), new Date(endsAt));
}

export function formatClockRange({ startsAt, endsAt }: Lobby): string {
  return CLOCK.formatRange(new Date(startsAt), new Date(endsAt));
}

export function formatDay(day: Date): string {
  return DAY.format(day);
}

export function formatWeek(days: Date[]): string {
  return SHORT_DAY.formatRange(days[0], days[days.length - 1]);
}

/** The name of the member who created the lobby, or the fallback when they have left the group. */
export function creatorName(
  members: { userId: string; displayName: string }[],
  lobby: Lobby,
  fallback: string,
): string {
  return (
    members.find((member) => member.userId === lobby.createdByUserId)
      ?.displayName ?? fallback
  );
}
