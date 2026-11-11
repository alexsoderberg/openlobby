import type { CSSProperties } from "react";
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
 * the whole block. A continuation marker comes right after the game name, so the two lines that fit the
 * smallest block show both when the name fits on one line. A longer name wraps and pushes the marker and
 * time out of that block: REQ-0015 wants the game name in full, and the dashed edge still shows the
 * continuation while the marker text stays readable to assistive technology.
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
        <a className="time-block__game" href={href}>
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
          <span className="time-block__marker">
            {m.calendarContinuesBefore}
          </span>
        )}
        {block.continuesAfter && (
          <span className="time-block__marker">{m.calendarContinuesAfter}</span>
        )}
        <span>{formatTimeRange(lobby.startsAt, lobby.endsAt)}</span>
        {lobby.groupName && <span>{lobby.groupName}</span>}
        <span>{m.lobbyPlayers(lobby.playerCount, lobby.maxPlayers)}</span>
      </div>
    </GenreFrame>
  );
}
