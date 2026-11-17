import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
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

function renderBlock(
  block: Partial<Parameters<typeof TimeBlock>[0]["block"]>,
  lobby: GridLobby = short,
) {
  render(
    <ul>
      <TimeBlock
        block={{
          item: lobby,
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
  // Both sides collapse white space: the time range may hold thin spaces, depending on the ICU version.
  const collapse = (text: string) => text.replace(/\s+/g, " ");
  expect(lines.map((line) => collapse(line.textContent!))).toEqual(
    ["Overwatch 2 › Competitive", "ends next day", time, "3/5 players"].map(
      collapse,
    ),
  );
});

describe("game logo", () => {
  const VERSION = "e".repeat(64);
  const logo = () => document.querySelector('[data-slot="game-logo"]');

  // The logo sits in the label's first line, which every block shows, even the shortest (REQ-0026).
  it("shows the small logo inside the first line of the shortest block, outside the link's name", () => {
    renderBlock({}, { ...short, gameId: "g1", gameLogoVersion: VERSION });

    const firstLine = document.querySelector(".time-block__game > span")!;
    expect(firstLine.contains(logo())).toBe(true);
    expect(logo()?.getAttribute("data-size")).toBe("small");
    expect(logo()?.querySelector("img")?.getAttribute("src")).toBe(
      `/api/games/g1/images/logo?v=${VERSION}`,
    );
    expect(
      screen.getByRole("link", { name: "Overwatch 2 › Competitive" }),
    ).toBeTruthy();
  });

  it("shows the monogram in the same slot when the game has no logo", () => {
    renderBlock({}, { ...short, gameId: "g1" });

    expect(logo()?.textContent).toBe("O2");
    expect(logo()?.getAttribute("data-size")).toBe("small");
  });

  it("shows no logo on a lobby with no game from the game list", () => {
    renderBlock({}, { ...short, gameId: null });

    expect(logo()).toBeNull();
  });
});
