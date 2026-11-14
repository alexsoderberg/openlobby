import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { formatTimeRange } from "../i18n";
import { TimeBlock, type GridLobby } from "./TimeBlock";

// A 15-minute lobby: its block is the smallest the grid draws, so CSS shows only the first lines.
const short: GridLobby = {
  id: "l1",
  gameName: "Overwatch 2",
  modeName: "Competitive",
  gameGenre: null,
  maxPlayers: 5,
  playerCount: 3,
  startsAt: new Date(2026, 10, 5, 18, 0).toISOString(),
  endsAt: new Date(2026, 10, 5, 18, 15).toISOString(),
  createdByUserId: "u1",
  joinedByMe: false,
};
const time = formatTimeRange(short.startsAt, short.endsAt);

function renderBlock(block: Partial<Parameters<typeof TimeBlock>[0]["block"]>) {
  render(
    <ul>
      <TimeBlock
        block={{
          item: short,
          startMinute: 18 * 60,
          endMinute: 18 * 60 + 15,
          continuesBefore: false,
          continuesAfter: false,
          column: 0,
          columns: 1,
          ...block,
        }}
        href="#"
        genre={null}
      />
    </ul>,
  );
}

it("describes the link with the continuation, time and players, which a short block may not show", () => {
  renderBlock({ continuesAfter: true });

  expect(
    screen.getByRole("link", {
      name: "Overwatch 2 › Competitive",
      description: `ends next day ${time} 3/5 players`,
    }),
  ).toBeTruthy();
});

it("describes the link with the marker of a lobby that began the day before", () => {
  renderBlock({ continuesBefore: true });

  expect(
    screen.getByRole("link", {
      description: `started the day before ${time} 3/5 players`,
    }),
  ).toBeTruthy();
});

it("orders the lines by priority: label, continuation, time, then the rest, so CSS leaves out the last ones first", () => {
  renderBlock({ continuesAfter: true });

  const lines = [...document.querySelector(".time-block__body")!.children];
  expect(lines.map((line) => line.textContent!.replace(/\s+/g, " "))).toEqual([
    "Overwatch 2 › Competitive",
    "ends next day",
    time,
    "3/5 players",
  ]);
});
