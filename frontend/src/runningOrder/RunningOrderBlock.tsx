import type { CSSProperties } from "react";
import type { Lobby } from "../api";
import { groupColorIndex } from "../groupColor";
import {
  formatDateTimeRange,
  formatTime,
  formatTimeRange,
  useMessages,
} from "../i18n";
import { lobbyLabel } from "../lobby";
import { Icon } from "../ui";
import { DAY_MINUTES, type Segment } from "./runningOrderLayout";

/** A lobby to draw, with its group (for the colour and the name) and the address of its page. */
export type RunningOrderLobby = Lobby & {
  groupId: string;
  groupName: string;
  href: string;
};

/** Where a segment sits on the day's track: CSS reads the fractions of the day and the lane. */
export function placeOf(segment: Segment<RunningOrderLobby>): CSSProperties {
  return {
    "--from": segment.startMinute / DAY_MINUTES,
    "--length": (segment.endMinute - segment.startMinute) / DAY_MINUTES,
    "--lane": segment.lane,
  } as CSSProperties;
}

/**
 * One lobby of a day: a block of its real length on wide screens, a text row under the day's bars on phones. The
 * same link serves both, so CSS picks the lines: the start time on phones and in a narrow block, the time range in
 * a wide one. The name is set in full, because CSS leaves lines out of a narrow block.
 */
export function RunningOrderBlock({
  segment,
}: {
  segment: Segment<RunningOrderLobby>;
}) {
  const m = useMessages();
  const { lobby, continuesBefore, continuesAfter } = segment;
  const label = lobbyLabel(lobby, m);
  // A lobby across midnight names its dates, because the block shows clock times only.
  const time =
    continuesBefore || continuesAfter
      ? formatDateTimeRange(lobby.startsAt, lobby.endsAt)
      : formatTimeRange(lobby.startsAt, lobby.endsAt);
  const players = m.lobbyPlayers(lobby.playerCount, lobby.maxPlayers);
  const name = m.runningOrder.blockName({
    label,
    time,
    players,
    group: lobby.groupName,
    continuesBefore,
    continuesAfter,
    you: lobby.joinedByMe,
  });
  return (
    <li
      className="running-order__block"
      style={placeOf(segment)}
      data-group-color={groupColorIndex(lobby.groupId)}
      data-mine={lobby.joinedByMe || undefined}
    >
      <a href={lobby.href} aria-label={name}>
        <span className="running-order__start">
          {formatTime(lobby.startsAt)}
        </span>
        <span className="running-order__label">
          {continuesBefore && <Icon name="chevronRight" />}
          {label}
          {continuesAfter && <Icon name="chevronRight" />}
        </span>
        {/* Clock times only, even across midnight: the chevrons mark the crossing, the name keeps the dates. */}
        <span className="running-order__time">
          {m.runningOrder.times(
            formatTime(lobby.startsAt),
            formatTime(lobby.endsAt),
          )}
        </span>
        <span className="running-order__group">{lobby.groupName}</span>
        <span className="running-order__spots">
          {lobby.maxPlayers === null
            ? players
            : m.runningOrder.spots(lobby.playerCount, lobby.maxPlayers)}
          {lobby.joinedByMe && (
            <span className="running-order__you">{m.runningOrder.you}</span>
          )}
        </span>
      </a>
    </li>
  );
}
