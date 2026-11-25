import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  formatDate,
  formatDateTimeRange,
  formatTime,
  formatTimeRange,
  formatWeekday,
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

function renderWeek(
  lobbies: RunningOrderLobby[],
  now = NOW,
  onCreateOn?: (start: Date, origin: HTMLElement) => void,
) {
  render(
    <RunningOrder
      heading="This week"
      days={weekItems(MONDAY, lobbies)}
      now={now}
      onCreateOn={onCreateOn}
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
    expect(block.textContent).toContain(
      en.runningOrder.times(formatTime(at(4, 19)), formatTime(at(4, 20))),
    );
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

  it("shows the start only on the day a lobby starts, and the end on the day it continues", () => {
    renderWeek([lobby("Night", at(4, 22), at(5, 1))]);
    const startOn = (date: Date) =>
      day(date).getByRole("link").querySelector(".running-order__start")!
        .textContent;
    expect(startOn(at(4, 0))).toBe(formatTime(at(4, 22)));
    expect(startOn(at(5, 0))).toBe(en.runningOrder.until(formatTime(at(5, 1))));
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

  it("offers no create button without onCreateOn", () => {
    renderWeek([lobby("Catan", at(5, 20), at(5, 22))]);
    expect(screen.queryByRole("button")).toBeNull();
    expect(document.querySelector(".running-order__create")).toBeNull();
  });

  it("offers one create button per future day with onCreateOn, today included", () => {
    renderWeek([], NOW, vi.fn());
    const buttons = screen.getAllByRole("button");
    expect(buttons.map((button) => button.getAttribute("aria-label"))).toEqual(
      [4, 5, 6, 7, 8].map((date) =>
        en.runningOrder.createOn(formatWeekday(at(date, 0))),
      ),
    );
    expect(buttons[0].textContent).toBe(en.lobbyCreateButton);
    expect(day(at(3, 0)).queryByRole("button")).toBeNull();
  });

  it("keeps the axis on an empty later day, so its time can be pointed at", () => {
    renderWeek([], NOW, vi.fn());
    const friday = dayGroup(at(6, 0));
    expect(friday.dataset.empty).toBeUndefined();
    expect(friday.querySelector(".running-order__create")).not.toBeNull();
    expect(
      dayGroup(at(3, 0)).querySelector(".running-order__track"),
    ).toBeNull();
  });

  it("starts from a button at 18:00 on a later day, and at the next half hour today", () => {
    const onCreateOn = vi.fn();
    renderWeek([], NOW, onCreateOn);
    const thursday = day(at(5, 0)).getByRole("button");
    fireEvent.click(thursday);
    expect(onCreateOn).toHaveBeenLastCalledWith(at(5, 18), thursday);
    fireEvent.click(day(at(4, 0)).getByRole("button"));
    expect(onCreateOn).toHaveBeenLastCalledWith(
      at(4, 18, 30),
      day(at(4, 0)).getByRole("button"),
    );
  });

  it("starts from the pointer at the half hour under it, over today's future time only", () => {
    const onCreateOn = vi.fn();
    renderWeek([], NOW, onCreateOn);
    const area = dayGroup(at(4, 0)).querySelector<HTMLElement>(
      ".running-order__create",
    )!;
    expect(area.getAttribute("aria-hidden")).toBe("true");
    expect(area.tabIndex).toBe(-1);
    // From 18:30 to midnight is 330 minutes, one a pixel: 100 px in is 20:10, so 20:00.
    expect(area.style.getPropertyValue("--from")).toBe(String(1110 / 1440));
    vi.spyOn(area, "getBoundingClientRect").mockReturnValue({
      left: 50,
      width: 330,
    } as DOMRect);
    fireEvent.click(area, { clientX: 150 });
    expect(onCreateOn).toHaveBeenCalledWith(
      at(4, 20),
      day(at(4, 0)).getByRole("button"),
    );
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
