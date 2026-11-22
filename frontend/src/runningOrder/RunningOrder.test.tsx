import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  formatDate,
  formatDateTimeRange,
  formatTime,
  formatTimeRange,
  formatWeekdayShort,
} from "../i18n";
import { en } from "../i18n/messages/en";
import { RunningOrder } from "./RunningOrder";
import type { RunningOrderLobby } from "./RunningOrderBlock";
import { weekItems } from "./week";

const at = (day: number, hour: number, minute = 0) =>
  new Date(2026, 10, day, hour, minute);
// Wednesday 4 November 2026, 18:18. The week runs Monday 2 to Sunday 8 November.
const NOW = at(4, 18, 18);
const MONDAY = at(2, 0);

const lobby = (
  id: string,
  start: Date,
  end: Date,
  overrides: Partial<RunningOrderLobby> = {},
): RunningOrderLobby => ({
  id,
  gameName: id,
  gameGenre: null,
  maxPlayers: 5,
  startsAt: start.toISOString(),
  endsAt: end.toISOString(),
  createdByUserId: "u1",
  playerCount: 3,
  joinedByMe: false,
  groupId: "g1",
  groupName: "Friday crew",
  href: `/groups/g1/lobbies/${id}`,
  ...overrides,
});

function renderWeek(lobbies: RunningOrderLobby[], now = NOW) {
  render(
    <RunningOrder
      heading="This week"
      days={weekItems(MONDAY, lobbies)}
      now={now}
    />,
  );
}

/** The day's group, found by its weekday and date heading. */
const dayGroup = (date: Date) =>
  screen.getByRole("group", {
    name: new RegExp(`${formatWeekdayShort(date)} ${formatDate(date)}`),
  });
const day = (date: Date) => within(dayGroup(date));

afterEach(() => vi.restoreAllMocks());

describe("RunningOrder", () => {
  it("is a section with its heading and a focusable scroll region", () => {
    renderWeek([]);
    expect(screen.getByRole("region", { name: "This week" })).toBeTruthy();
    const scroll = screen.getByRole("region", {
      name: en.runningOrder.scrollLabel,
    });
    expect(scroll.tabIndex).toBe(0);
  });

  it("has one day from Monday to Sunday, each with its heading, and marks today", () => {
    renderWeek([]);
    const headings = screen.getAllByRole("heading", { level: 3 });
    expect(headings).toHaveLength(7);
    expect(headings[0].textContent).toContain(formatWeekdayShort(MONDAY));
    expect(
      headings.filter((heading) => heading.getAttribute("aria-current")),
    ).toEqual([headings[2]]);
    expect(headings[2].getAttribute("aria-current")).toBe("date");
    expect(headings[2].textContent).toContain(
      en.runningOrder.today(formatDate(at(4, 0))),
    );
  });

  it("says Nothing booked on each day without a lobby, with no axis", () => {
    renderWeek([lobby("Catan", at(5, 20), at(5, 22))]);
    expect(screen.getAllByText(en.runningOrder.nothingBooked)).toHaveLength(6);
    expect(day(at(5, 0)).queryByText(en.runningOrder.nothingBooked)).toBeNull();
    const empty = dayGroup(at(2, 0));
    expect(empty.querySelector(".running-order__track")).toBeNull();
  });

  it("lists each day's lobbies as links in start order, with their full name", () => {
    renderWeek([
      lobby("Late", at(4, 21), at(4, 23)),
      lobby("Early", at(4, 19), at(4, 20), {
        groupId: "g2",
        groupName: "Ranked grind",
        joinedByMe: true,
        maxPlayers: null,
        playerCount: 1,
      }),
    ]);
    const links = day(at(4, 0)).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/groups/g1/lobbies/Early",
      "/groups/g1/lobbies/Late",
    ]);
    expect(links[0].getAttribute("aria-label")).toBe(
      `Early, ${formatTimeRange(at(4, 19), at(4, 20))}, 1 player, Ranked grind, you`,
    );
    expect(links[1].getAttribute("aria-label")).toBe(
      `Late, ${formatTimeRange(at(4, 21), at(4, 23))}, 3/5 players, Friday crew`,
    );
    expect(links[0].closest("ol")).toBe(links[1].closest("ol"));
  });

  it("shows the label, time, group, spots and you as text on the block", () => {
    renderWeek([lobby("Catan", at(4, 19), at(4, 20), { joinedByMe: true })]);
    const block = day(at(4, 0)).getByRole("link").closest("li")!;
    expect(block.textContent).toContain("Catan");
    expect(block.textContent).toContain(formatTimeRange(at(4, 19), at(4, 20)));
    expect(block.textContent).toContain("Friday crew");
    expect(block.textContent).toContain("3/5");
    expect(block.textContent).toContain(en.runningOrder.you);
    expect(block.dataset.mine).toBe("true");
  });

  it("colours a block by its group and places it at its start, length and lane", () => {
    renderWeek([
      lobby("A", at(4, 18), at(4, 21), { groupId: "a" }),
      lobby("B", at(4, 19), at(4, 20)),
    ]);
    const blocks = day(at(4, 0))
      .getAllByRole("link")
      .map((link) => link.closest("li")!);
    expect(blocks[0].dataset.groupColor).toBe("5");
    expect(blocks[0].style.getPropertyValue("--from")).toBe("0.75");
    expect(blocks[0].style.getPropertyValue("--length")).toBe("0.125");
    expect(blocks[1].style.getPropertyValue("--lane")).toBe("1");
    const track = blocks[0].closest<HTMLElement>(".running-order__track")!;
    expect(track.style.getPropertyValue("--lanes")).toBe("2");
  });

  it("shows a lobby that crosses midnight on both days, with the markers in its name", () => {
    renderWeek([lobby("Night", at(6, 22), at(7, 2))]);
    expect(
      day(at(6, 0)).getByRole("link").getAttribute("aria-label"),
    ).toContain("ends next day");
    expect(
      day(at(7, 0)).getByRole("link").getAttribute("aria-label"),
    ).toContain("started the day before");
    for (const date of [at(6, 0), at(7, 0)]) {
      const link = day(date).getByRole("link");
      expect(link.querySelector(".running-order__time")!.textContent).toBe(
        `${formatTime(at(6, 22))}–${formatTime(at(7, 2))}`,
      );
      expect(link.getAttribute("aria-label")).toContain(
        formatDateTimeRange(at(6, 22), at(7, 2)),
      );
    }
  });

  it("draws the Now line only in today's row, hidden from the accessibility tree", () => {
    renderWeek([
      lobby("Today", at(4, 20), at(4, 21)),
      lobby("Friday", at(6, 20), at(6, 21)),
    ]);
    const lines = document.querySelectorAll<HTMLElement>(".running-order__now");
    expect(lines).toHaveLength(1);
    expect(lines[0].closest("[aria-hidden='true']")).not.toBeNull();
    expect(dayGroup(at(4, 0)).contains(lines[0])).toBe(true);
    expect(lines[0].style.getPropertyValue("--now")).toBe(String(1098 / 1440));
  });

  it("keeps the axis and the Now line on today without a lobby, and says Nothing booked", () => {
    renderWeek([lobby("Friday", at(6, 20), at(6, 21))]);
    const today = dayGroup(at(4, 0));
    expect(within(today).getByText(en.runningOrder.nothingBooked)).toBeTruthy();
    expect(today.querySelector(".running-order__track")).not.toBeNull();
    expect(today.querySelector(".running-order__now")).not.toBeNull();
    expect(today.dataset.empty).toBeUndefined();
    expect(within(today).queryByRole("list")).toBeNull();
    expect(
      dayGroup(at(5, 0)).querySelector(".running-order__track"),
    ).toBeNull();
  });

  it("draws no Now line in another week", () => {
    renderWeek([lobby("Today", at(4, 20), at(4, 21))], at(11, 12));
    expect(document.querySelector(".running-order__now")).toBeNull();
  });

  it("offers no create button", () => {
    renderWeek([lobby("Catan", at(5, 20), at(5, 22))]);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("scrolls once on opening to the hour of the first lobby that has not ended", () => {
    // jsdom does no layout: the axis is 2400 px wide, 100 px an hour.
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(2400);
    renderWeek([
      lobby("Ended", at(4, 9), at(4, 10)),
      lobby("Next", at(5, 20, 30), at(5, 22)),
    ]);
    expect(
      screen.getByRole("region", { name: en.runningOrder.scrollLabel })
        .scrollLeft,
    ).toBe(2000);
  });
});
