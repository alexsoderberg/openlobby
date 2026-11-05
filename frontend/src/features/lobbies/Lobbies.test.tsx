import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  ApiProvider,
  type ApiClient,
  type Group,
  type Lobby,
} from "../../api";
import { formatTimeRange, formatWeekdayShort } from "../../i18n";
import { en } from "../../i18n/messages/en";
import { fakeApiClient, testUser } from "../../test/fakeApiClient";
import { dayColumns, selectedColumns } from "../../test/weekGrid";
import { Lobbies } from "./Lobbies";

// Wednesday 4 November 2026, 12:00 local time. The week runs Monday 2 to Sunday 8 November.
const NOW = new Date(2026, 10, 4, 12, 0);
const local = (day: number, hour: number, minute = 0) =>
  new Date(2026, 10, day, hour, minute).toISOString();

const members: Group["members"] = [
  { userId: testUser.userId, displayName: "Maja Lind", role: "admin" },
  { userId: "u2", displayName: "Kim Berg", role: "member" },
];

function lobby(
  overrides: Partial<Lobby> & Pick<Lobby, "id" | "gameName">,
): Lobby {
  return {
    maxPlayers: 4,
    startsAt: local(5, 18),
    endsAt: local(5, 20),
    createdByUserId: testUser.userId,
    playerCount: 1,
    joinedByMe: false,
    ...overrides,
  };
}

const catan = lobby({ id: "l1", gameName: "Catan", playerCount: 2 });
const chess = lobby({
  id: "l2",
  gameName: "Chess",
  maxPlayers: null,
  playerCount: 3,
  startsAt: local(6, 22),
  endsAt: local(7, 2),
  createdByUserId: "u2",
});
const games = [
  { id: "g-chess", name: "Chess", defaultMaxPlayers: null },
  { id: "g-catan", name: "Catan", defaultMaxPlayers: 4 },
];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

function renderLobbies(overrides: Partial<ApiClient> = {}) {
  const client = fakeApiClient({
    listGroupGames: vi.fn(() => Promise.resolve(games)),
    ...overrides,
  });
  const onUnauthenticated = vi.fn();
  const view = render(
    <ApiProvider client={client}>
      <Lobbies
        groupId="g1"
        members={members}
        onUnauthenticated={onUnauthenticated}
      />
    </ApiProvider>,
  );
  return { client, onUnauthenticated, view };
}

const withLobbies = (...lobbies: Lobby[]) => ({
  listUpcomingLobbies: vi.fn(() => Promise.resolve(lobbies)),
});

const occurrences = (text: string | null, part: string) =>
  (text ?? "").split(part).length - 1;

const dayText = (iso: string) =>
  new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" }).format(
    new Date(iso),
  );

describe("lobby list", () => {
  it("shows game, time, creator and spots for each lobby in the server's order", async () => {
    renderLobbies(withLobbies(catan, chess));

    const rows = await screen.findAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByRole("link").textContent).toBe("Catan");
    expect(rows[0].textContent).toContain(en.lobbyCreatedBy("Maja Lind"));
    expect(rows[0].textContent).toContain("2/4 players");
    expect(within(rows[1]).getByRole("link").textContent).toBe("Chess");
    expect(rows[1].textContent).toContain(en.lobbyCreatedBy("Kim Berg"));
    expect(rows[1].textContent).toContain("3 players");
  });

  it("links each lobby to its detail page", async () => {
    renderLobbies(withLobbies(catan));

    const link = await screen.findByRole("link", { name: "Catan" });
    expect(link.getAttribute("href")).toBe("/groups/g1/lobbies/l1");
  });

  it("shows the end date only when the lobby ends the next day", async () => {
    renderLobbies(withLobbies(catan, chess));

    const [same, overnight] = await screen.findAllByRole("listitem");
    // The date of a lobby that ends the same day appears once, whatever the locale.
    expect(occurrences(same.textContent, dayText(catan.startsAt))).toBe(1);
    expect(overnight.textContent).toContain(dayText(chess.startsAt));
    expect(overnight.textContent).toContain(dayText(chess.endsAt));
  });

  it("names a creator who has left the group as an unknown member", async () => {
    renderLobbies(
      withLobbies(lobby({ id: "l3", gameName: "Go", createdByUserId: "gone" })),
    );

    expect(
      await screen.findByText(en.lobbyCreatedBy(en.lobbyUnknownCreator)),
    ).toBeTruthy();
  });

  it("shows the empty text when there are no lobbies", async () => {
    renderLobbies();

    expect(
      await screen.findByText("No lobbies have been created yet"),
    ).toBeTruthy();
  });

  it("shows the error with a retry that loads again", async () => {
    const listUpcomingLobbies = vi
      .fn()
      .mockRejectedValueOnce(new ApiError(503, "service_unavailable"))
      .mockResolvedValue([catan]);
    renderLobbies({ listUpcomingLobbies });

    expect((await screen.findByRole("alert")).textContent).toContain(
      en.errors.service_unavailable,
    );
    fireEvent.click(screen.getByRole("button", { name: en.tryAgain }));
    expect(await screen.findByRole("link", { name: "Catan" })).toBeTruthy();
  });

  it("hands an expired session over", async () => {
    const { onUnauthenticated } = renderLobbies({
      listUpcomingLobbies: vi.fn(() =>
        Promise.reject(new ApiError(401, "unauthenticated")),
      ),
    });

    await vi.waitFor(() => expect(onUnauthenticated).toHaveBeenCalled());
  });
});

const calendarButton = () =>
  screen.getByRole("button", { name: en.lobbyViewCalendar });
/** The placement a block was given: start and span in minutes, column and number of columns. */
const blockStyle = (element: HTMLElement) => {
  const style = element.closest<HTMLElement>("li.time-block")!.style;
  const read = (name: string) => style.getPropertyValue(`--${name}`);
  return {
    start: read("start"),
    span: read("span"),
    column: read("column"),
    columns: read("columns"),
  };
};
const listButton = () => screen.getByRole("button", { name: en.lobbyViewList });

describe("calendar view", () => {
  it("starts in the list view", async () => {
    renderLobbies(withLobbies(catan));

    await screen.findByRole("link", { name: "Catan" });
    expect(listButton().getAttribute("aria-pressed")).toBe("true");
    expect(calendarButton().getAttribute("aria-pressed")).toBe("false");
    expect(
      screen.queryByRole("button", { name: en.calendarNextWeek }),
    ).toBeNull();
  });

  it("switches with native buttons that the keyboard reaches", async () => {
    renderLobbies(withLobbies(catan));
    await screen.findByRole("link", { name: "Catan" });

    calendarButton().focus();
    expect(document.activeElement).toBe(calendarButton());
    expect(calendarButton().tagName).toBe("BUTTON");
    fireEvent.click(calendarButton());
    expect(calendarButton().getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(listButton());
    expect(screen.getByRole("link", { name: "Catan" })).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: en.calendarNextWeek }),
    ).toBeNull();
  });

  it("shows the week Monday to Sunday with each lobby in the column of its day", async () => {
    renderLobbies(withLobbies(catan, chess));
    await screen.findByRole("link", { name: "Catan" });
    fireEvent.click(calendarButton());

    expect(dayColumns()).toHaveLength(7);
    expect(screen.getAllByRole("heading", { level: 4 })).toHaveLength(7);
    expect(
      within(dayColumns()[3]).getByRole("link", { name: "Catan" }),
    ).toBeTruthy();
    expect(dayColumns()[0].textContent).toContain(
      formatWeekdayShort(new Date(2026, 10, 2)),
    );
  });

  it("splits a lobby that crosses midnight over both days and marks the continuation", async () => {
    renderLobbies(withLobbies(chess));
    await screen.findByRole("link", { name: "Chess" });
    fireEvent.click(calendarButton());

    const friday = within(dayColumns()[4]).getByRole("link", { name: "Chess" });
    const saturday = within(dayColumns()[5]).getByRole("link", {
      name: "Chess",
    });
    expect(friday.closest("li")!.textContent).toContain(
      en.calendarContinuesAfter,
    );
    expect(saturday.closest("li")!.textContent).toContain(
      en.calendarContinuesBefore,
    );
    expect(
      within(friday.closest("li")!).getByText("ends next day"),
    ).toBeTruthy();
    expect(
      within(saturday.closest("li")!).getByText("started the day before"),
    ).toBeTruthy();
    // Right after the game name: the smallest block shows two lines.
    expect(friday.nextElementSibling!.textContent).toBe(
      en.calendarContinuesAfter,
    );
    expect(saturday.nextElementSibling!.textContent).toBe(
      en.calendarContinuesBefore,
    );
    expect(blockStyle(friday)).toMatchObject({ start: "1320", span: "120" });
    expect(blockStyle(saturday)).toMatchObject({ start: "0", span: "120" });
  });

  it("shows a lobby that started last week and still runs on Monday", async () => {
    const carried = lobby({
      id: "l5",
      gameName: "Poker",
      startsAt: local(1, 22),
      endsAt: local(2, 3),
    });
    renderLobbies(withLobbies(carried));
    await screen.findByRole("link", { name: "Poker" });
    fireEvent.click(calendarButton());

    const poker = within(dayColumns()[0]).getByRole("link", { name: "Poker" });
    expect(blockStyle(poker)).toMatchObject({ start: "0", span: "180" });
    expect(poker.closest("li")!.textContent).toContain(
      en.calendarContinuesBefore,
    );
    fireEvent.click(screen.getByRole("button", { name: en.calendarNextWeek }));
    expect(screen.queryByRole("link", { name: "Poker" })).toBeNull();
  });

  it("places a block by its start and duration, and shows game, time range and spots", async () => {
    renderLobbies(withLobbies(catan, chess));
    await screen.findByRole("link", { name: "Catan" });
    fireEvent.click(calendarButton());

    const block = screen.getByRole("link", { name: "Catan" }).closest("li")!;
    expect(blockStyle(block)).toMatchObject({ start: "1080", span: "120" });
    expect(block.textContent).toContain(
      formatTimeRange(catan.startsAt, catan.endsAt),
    );
    expect(block.textContent).toContain("2/4 players");
    expect(
      within(dayColumns()[4])
        .getByRole("link", { name: "Chess" })
        .closest("li")!.textContent,
    ).toContain("3 players");
  });

  it("shows overlapping lobbies side by side in the same day", async () => {
    const overlapping = lobby({
      id: "l3",
      gameName: "Go",
      startsAt: local(5, 19),
      endsAt: local(5, 21),
    });
    renderLobbies(withLobbies(catan, overlapping));
    await screen.findByRole("link", { name: "Catan" });
    fireEvent.click(calendarButton());

    const catanBlock = screen
      .getByRole("link", { name: "Catan" })
      .closest("li")!;
    const goBlock = screen.getByRole("link", { name: "Go" }).closest("li")!;
    expect(blockStyle(catanBlock)).toMatchObject({ column: "0", columns: "2" });
    expect(blockStyle(goBlock)).toMatchObject({ column: "1", columns: "2" });
  });

  it("shows only the selected day on phones, switched with the Day pills", async () => {
    renderLobbies(withLobbies(catan, chess));
    await screen.findByRole("link", { name: "Catan" });
    fireEvent.click(calendarButton());

    expect(selectedColumns()).toEqual([dayColumns()[2]]);
    const pills = within(
      screen.getByRole("group", { name: en.calendarDayPillsLabel }),
    );
    fireEvent.click(
      pills.getByRole("button", {
        name: new RegExp(formatWeekdayShort(new Date(2026, 10, 5))),
      }),
    );
    expect(selectedColumns()).toEqual([dayColumns()[3]]);
  });

  it("moves to the next week, and has no way back", async () => {
    const later = lobby({
      id: "l4",
      gameName: "Risk",
      startsAt: local(10, 18),
      endsAt: local(10, 20),
    });
    renderLobbies(withLobbies(catan, later));
    await screen.findByRole("link", { name: "Catan" });
    fireEvent.click(calendarButton());
    expect(screen.queryByRole("link", { name: "Risk" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: en.calendarNextWeek }));

    expect(screen.getByRole("link", { name: "Risk" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Catan" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: /previous|back|this week/i }),
    ).toBeNull();
  });

  it("shows the same empty text as the list", async () => {
    renderLobbies();
    await screen.findByText("No lobbies have been created yet");
    fireEvent.click(calendarButton());

    expect(screen.getByText("No lobbies have been created yet")).toBeTruthy();
  });

  it("starts in the list again on a later visit", async () => {
    const first = renderLobbies(withLobbies(catan));
    await screen.findByRole("link", { name: "Catan" });
    fireEvent.click(calendarButton());
    first.view.unmount();

    renderLobbies(withLobbies(catan));
    await screen.findByRole("link", { name: "Catan" });
    expect(listButton().getAttribute("aria-pressed")).toBe("true");
  });
});

const openButton = () =>
  screen.getByRole("button", { name: en.lobbyCreateButton });
const dialog = () =>
  screen.queryByRole("dialog", { name: en.lobbyCreateHeading });

describe("create lobby popover", () => {
  it("keeps the form hidden until the button is pressed", async () => {
    renderLobbies(withLobbies(catan));
    await screen.findByRole("link", { name: "Catan" });

    expect(dialog()).toBeNull();
    fireEvent.click(openButton());

    expect(dialog()).toBeTruthy();
    expect(openButton().getAttribute("aria-expanded")).toBe("true");
    expect(await screen.findByLabelText(en.lobbyGameLabel)).toBe(
      document.activeElement,
    );
  });

  it("closes on Esc and Cancel with focus back on the button, but not on the scrim", async () => {
    renderLobbies(withLobbies(catan));
    await screen.findByRole("link", { name: "Catan" });

    fireEvent.click(openButton());
    await screen.findByLabelText(en.lobbyGameLabel);
    fireEvent.click(document.querySelector(".scrim") as HTMLElement);
    expect(dialog()).toBeTruthy();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(openButton());

    fireEvent.click(openButton());
    await screen.findByLabelText(en.lobbyGameLabel);
    fireEvent.click(screen.getByRole("button", { name: en.cancel }));
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(openButton());
  });

  it("opens with a fresh form each time", async () => {
    renderLobbies(withLobbies(catan));
    await screen.findByRole("link", { name: "Catan" });
    fireEvent.click(openButton());
    fireEvent.change(await screen.findByLabelText(en.lobbyStartLabel), {
      target: { value: "18:00" },
    });
    fireEvent.keyDown(document, { key: "Escape" });

    fireEvent.click(openButton());

    expect(
      (await screen.findByLabelText<HTMLInputElement>(en.lobbyStartLabel))
        .value,
    ).toBe("");
  });

  it("closes after a save, refreshes the list and confirms", async () => {
    const { client } = renderLobbies({
      ...withLobbies(catan),
      createLobby: vi.fn(() => Promise.resolve(catan)),
    });
    await screen.findByRole("link", { name: "Catan" });
    fireEvent.click(openButton());
    const set = async (label: string, value: string) =>
      fireEvent.change(await screen.findByLabelText(label), {
        target: { value },
      });
    await set(en.lobbyGameLabel, "g-catan");
    await set(en.lobbyStartLabel, "18:00");
    await set(en.lobbyEndLabel, "20:00");

    fireEvent.click(
      within(dialog()!).getByRole("button", { name: en.lobbyCreateSubmit }),
    );

    expect(await screen.findByText(en.lobbyCreated)).toBeTruthy();
    expect(dialog()).toBeNull();
    expect(client.listUpcomingLobbies).toHaveBeenCalledTimes(2);
    expect(document.activeElement).toBe(openButton());
  });

  it("keeps Tab and Shift+Tab inside the form, through the game select", async () => {
    renderLobbies(withLobbies(catan));
    await screen.findByRole("link", { name: "Catan" });
    fireEvent.click(openButton());
    const game = await screen.findByLabelText(en.lobbyGameLabel);
    const cancel = screen.getByRole("button", { name: en.cancel });

    cancel.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(game);

    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(cancel);
  });
});

describe("create lobby from the calendar", () => {
  const dayButton = (name: string) =>
    screen.getByRole("button", { name: en.calendarCreateOnDay(name) });
  const dayName = (day: number) =>
    new Intl.DateTimeFormat(undefined, {
      weekday: "long",
      day: "numeric",
      month: "short",
    }).format(new Date(2026, 10, day));

  async function showCalendar() {
    renderLobbies(withLobbies(catan));
    await screen.findByRole("link", { name: "Catan" });
    fireEvent.click(calendarButton());
  }

  it("closes after a save with focus back on the day's control", async () => {
    renderLobbies({
      ...withLobbies(catan),
      createLobby: vi.fn(() => Promise.resolve(catan)),
    });
    await screen.findByRole("link", { name: "Catan" });
    fireEvent.click(calendarButton());
    const day = dayButton(dayName(6));
    fireEvent.click(day);
    for (const [label, value] of [
      [en.lobbyGameLabel, "g-catan"],
      [en.lobbyStartLabel, "18:00"],
      [en.lobbyEndLabel, "20:00"],
    ])
      fireEvent.change(await screen.findByLabelText(label), {
        target: { value },
      });

    fireEvent.click(
      within(dialog()!).getByRole("button", { name: en.lobbyCreateSubmit }),
    );

    expect(await screen.findByText(en.lobbyCreated)).toBeTruthy();
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(day);
  });

  it("opens the form with that day's date and empty times, from the day's control", async () => {
    await showCalendar();

    fireEvent.click(dayButton(dayName(6)));

    const value = async (label: string) =>
      (await screen.findByLabelText<HTMLInputElement>(label)).value;
    expect(await value(en.lobbyDateLabel)).toBe("2026-11-06");
    expect(await value(en.lobbyStartLabel)).toBe("");
    expect(await value(en.lobbyEndLabel)).toBe("");
  });

  it("opens the form with date and start rounded down to the half hour, and an end two hours later, from a click on the grid", async () => {
    await showCalendar();
    const friday = dayButton(dayName(6));
    // The column is 1440 px tall, so one px is one minute.
    vi.spyOn(friday, "getBoundingClientRect").mockReturnValue({
      top: 100,
      height: 1440,
    } as DOMRect);

    fireEvent.click(friday, { detail: 1, clientY: 100 + 21 * 60 + 50 });

    const value = async (label: string) =>
      (await screen.findByLabelText<HTMLInputElement>(label)).value;
    expect(await value(en.lobbyDateLabel)).toBe("2026-11-06");
    expect(await value(en.lobbyStartLabel)).toBe("21:30");
    expect(await value(en.lobbyEndLabel)).toBe("23:30");
  });

  it("makes only the time from now on clickable today", async () => {
    await showCalendar();
    const today = dayButton(dayName(4));
    // Now is 12:00, so the control starts at minute 720 and a click 90 px into its 720 px is at 13:30.
    expect(today.style.getPropertyValue("--from")).toBe("720");
    vi.spyOn(today, "getBoundingClientRect").mockReturnValue({
      top: 0,
      height: 720,
    } as DOMRect);

    fireEvent.click(today, { detail: 1, clientY: 90 });

    expect(
      (await screen.findByLabelText<HTMLInputElement>(en.lobbyStartLabel))
        .value,
    ).toBe("13:30");
  });

  it("does not open from a click on a lobby card, which still links to its page", async () => {
    await showCalendar();
    const card = screen.getByRole("link", { name: "Catan" }).closest("li")!;

    fireEvent.click(within(card).getByText(/2\/4 players/));
    fireEvent.click(within(card).getByRole("link", { name: "Catan" }));

    expect(dialog()).toBeNull();
  });

  it("has no control on days before today, and returns focus to the day's control on close", async () => {
    await showCalendar();

    expect(
      screen.queryByRole("button", {
        name: en.calendarCreateOnDay(dayName(3)),
      }),
    ).toBeNull();
    const today = dayButton(dayName(4));
    fireEvent.click(today);
    await screen.findByLabelText(en.lobbyGameLabel);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(document.activeElement).toBe(today);
  });
});
