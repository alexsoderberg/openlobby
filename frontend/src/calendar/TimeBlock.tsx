import type { CSSProperties } from "react";
import type { Lobby } from "../api";
import { formatTimeRange, useMessages } from "../i18n";
import type { Block } from "./gridGeometry";

/** A lobby to draw, with the name of its group when the grid spans several groups. */
export type GridLobby = Lobby & { groupName?: string };

/**
 * One lobby on a day column. Top and height are its true start and duration (CSS reads them from the
 * custom properties); a short block keeps its position and only grows to stay readable. The link covers
 * the whole block.
 */
export function TimeBlock({
  block,
  href,
}: {
  block: Block<GridLobby>;
  href: string;
}) {
  const m = useMessages();
  const { item: lobby } = block;
  const place = {
    "--start": block.startMinute,
    "--span": block.endMinute - block.startMinute,
    "--column": block.column,
    "--columns": block.columns,
  } as CSSProperties;
  return (
    <li
      className="time-block"
      style={place}
      data-continues-before={block.continuesBefore || undefined}
      data-continues-after={block.continuesAfter || undefined}
    >
      <div className="time-block__body">
        <a className="time-block__game" href={href}>
          {lobby.gameName}
        </a>
        <span>{formatTimeRange(lobby.startsAt, lobby.endsAt)}</span>
        {lobby.groupName && <span>{lobby.groupName}</span>}
        <span>{m.lobbyPlayers(lobby.playerCount, lobby.maxPlayers)}</span>
        {block.continuesBefore && (
          <span className="time-block__marker">
            {m.calendarContinuesBefore}
          </span>
        )}
        {block.continuesAfter && (
          <span className="time-block__marker">{m.calendarContinuesAfter}</span>
        )}
      </div>
    </li>
  );
}
