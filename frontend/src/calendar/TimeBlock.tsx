import { useId, type CSSProperties } from "react";
import type { Genre, Lobby } from "../api";
import { GenreFrame } from "../genres";
import { formatTimeRange, useMessages } from "../i18n";
import { lobbyGameLabel, lobbyLabelDetail } from "../lobby";
import type { Block } from "./gridGeometry";

/** A lobby to draw, with the name of its group when the grid spans several groups. */
export type GridLobby = Lobby & { groupName?: string };

/**
 * One lobby on a day column. Top and height are its true start and duration (CSS reads them from the
 * custom properties); a short block keeps its position and only grows to stay readable. The link covers
 * the whole block. The lines come in priority order: CSS leaves out whole lines from the end when the block
 * is too short, so the label stays, then the continuation marker, then the time. A game name that wraps is
 * capped at the whole lines the block holds and clipped below them (.time-block__game). Lines left out are only
 * clipped, so they stay in the accessibility tree; aria-describedby also adds the marker, time and players to
 * the link's description, so they are read with the link.
 */
export function TimeBlock({
  block,
  href,
  genre,
}: {
  block: Block<GridLobby>;
  href: string;
  genre: Genre | null;
}) {
  const m = useMessages();
  const { item: lobby } = block;
  const detail = lobbyLabelDetail(lobby, m);
  const id = useId();
  const lineId = (name: string) => `${id}${name}`;
  const describedBy = [
    block.continuesBefore && lineId("before"),
    block.continuesAfter && lineId("after"),
    lineId("time"),
    lineId("players"),
  ]
    .filter(Boolean)
    .join(" ");
  const place = {
    "--start": block.startMinute,
    "--span": block.endMinute - block.startMinute,
    "--column": block.column,
    "--columns": block.columns,
  } as CSSProperties;
  return (
    <GenreFrame
      as="li"
      genre={genre}
      className="time-block"
      style={place}
      data-continues-before={block.continuesBefore || undefined}
      data-continues-after={block.continuesAfter || undefined}
    >
      <div className="time-block__body">
        <a
          className="time-block__game"
          href={href}
          aria-describedby={describedBy}
        >
          <span>{lobbyGameLabel(lobby, m)}</span>
          {/* A real space keeps the link's accessible name "game › mode"; flex layout hides it. */}{" "}
          {detail && (
            <span className="time-block__detail">
              {m.lobbyLabelSeparator}
              {detail}
            </span>
          )}
        </a>
        {block.continuesBefore && (
          <span id={lineId("before")} className="time-block__marker">
            {m.calendarContinuesBefore}
          </span>
        )}
        {block.continuesAfter && (
          <span id={lineId("after")} className="time-block__marker">
            {m.calendarContinuesAfter}
          </span>
        )}
        <span id={lineId("time")}>
          {formatTimeRange(lobby.startsAt, lobby.endsAt)}
        </span>
        {lobby.groupName && <span>{lobby.groupName}</span>}
        <span id={lineId("players")}>
          {m.lobbyPlayers(lobby.playerCount, lobby.maxPlayers)}
        </span>
      </div>
    </GenreFrame>
  );
}
