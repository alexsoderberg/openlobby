import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  ApiProvider,
  type ApiClient,
  type Group,
  type Lobby,
} from "../../api";
import {
  formatDateTime,
  formatTime,
  formatWeekday,
  formatWeekdayShort,
} from "../../i18n";
import { en } from "../../i18n/messages/en";
import { fakeApiClient, testUser } from "../../test/fakeApiClient";
import { findToast } from "../../test/toasts";
import { Toaster } from "../../ui";
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
    gameGenre: null,
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
  { id: "g-chess", name: "Chess", defaultMaxPlayers: null, genre: null },
  { id: "g-catan", name: "Catan", defaultMaxPlayers: 4, genre: null },
];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

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
        groupName="Friday crew"
        members={members}
        renderHeader={({ createButton, upcomingCount }) => (
          <header>
            {createButton}
            {upcomingCount}
          </header>
        )}
        onUnauthenticated={onUnauthenticated}
      />
      <Toaster />
    </ApiProvider>,
  );
  return { client, onUnauthenticated, view };
}

const withLobbies = (...lobbies: Lobby[]) => ({
  listUpcomingLobbies: vi.fn(() => Promise.resolve(lobbies)),
});

/** sonner hands a toast to the region in a timeout, so a toast that is not shown is checked after one. */
const settleToasts = () =>
  act(() => new Promise<void>((resolve) => setTimeout(resolve)));

describe("header and heading row (REQ-0029 item 5)", () => {
  it("hands the page header the Create lobby button, and the number of upcoming lobbies once they are loaded", async () => {
    renderLobbies(withLobbies(catan, chess));

    const header = screen.getByRole("banner");
    expect(
      within(header).getByRole("button", { name: en.lobbyCreateButton }),
    ).toBeTruthy();
    expect(header.textContent).toBe(en.lobbyCreateButton);
    await screen.findByRole("link", { name: "Catan" });
    expect(header.textContent).toBe(`${en.lobbyCreateButton}2`);
  });

  it("puts the view toggle after the heading, in the heading's row", async () => {
    renderLobbies(withLobbies());

    const heading = await screen.findByRole("heading", {
      name: en.lobbiesHeading,
    });
    const toggle = within(heading.parentElement!).getByRole("group", {
      name: en.lobbyViewLabel,
    });
    expect(
      heading.compareDocumentPosition(toggle) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});

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

  it("groups the lobbies under one heading per day, today's marked, keeping the server's order", async () => {
    const go = lobby({
      id: "l0",
      gameName: "Go",
      startsAt: local(4, 18),
      endsAt: local(4, 20),
    });
    const kubb = lobby({
      id: "l4",
      gameName: "Kubb",
      startsAt: local(5, 20),
      endsAt: local(5, 21),
    });
    renderLobbies(withLobbies(go, catan, kubb, chess));
    await screen.findByRole("link", { name: "Catan" });

    const days = screen.getAllByRole("heading", { level: 3 });
    expect(days.map((day) => day.textContent)).toEqual([
      en.runningOrder.today(formatWeekday(go.startsAt)),
      formatWeekday(catan.startsAt),
      formatWeekday(chess.startsAt),
    ]);
    expect(
      days.map((day) =>
        within(screen.getByRole("list", { name: day.textContent! }))
          .getAllByRole("link")
          .map((link) => link.textContent),
      ),
    ).toEqual([["Go"], ["Catan", "Kubb"], ["Chess"]]);
  });

  it("shows the spots as a figure and a word, and Full when no spot is left", async () => {
    renderLobbies(
      withLobbies(
        { ...catan, playerCount: 4 },
        lobby({ id: "l5", gameName: "Go", maxPlayers: null, playerCount: 1 }),
      ),
    );

    const [full, single] = await screen.findAllByRole("listitem");
    expect(full.textContent).toMatch(/4\/4 Full$/);
    expect(single.textContent).toMatch(/1 player$/);
  });

  it("shows no genre name, or genre theme on a row (REQ-0029 item 10)", async () => {
    renderLobbies(
      withLobbies({
        ...catan,
        gameGenre: "strategy",
        gameId: "game1",
      }),
    );

    const [row] = await screen.findAllByRole("listitem");
    expect(within(row).queryByText(en.genre.strategy)).toBeNull();
    expect(row.hasAttribute("data-genre")).toBe(false);
  });

  it("links each lobby to its detail page", async () => {
    renderLobbies(withLobbies(catan));

    const link = await screen.findByRole("link", { name: "Catan" });
    expect(link.getAttribute("href")).toBe("/groups/g1/lobbies/l1");
  });

  it("shows the end time under the start, with a date only when the lobby ends on another day", async () => {
    renderLobbies(withLobbies(catan, chess));

    const [same, overnight] = await screen.findAllByRole("listitem");
    // The day heading holds the start date, so a row repeats no date unless it ends on another day.
    expect(
      within(same).getByText(en.lineUpEnds(formatTime(catan.endsAt))),
    ).toBeTruthy();
    expect(
      within(overnight).getByText(en.lineUpEnds(formatDateTime(chess.endsAt))),
    ).toBeTruthy();
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

    expect(await screen.findByText(en.runningOrder.nothingBooked)).toBeTruthy();
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
/** The placement a block was given: start and length as fractions of the day, and its lane. */
const blockStyle = (element: HTMLElement) => {
  const style = element.closest<HTMLElement>("li")!.style;
  const read = (name: string) => style.getPropertyValue(`--${name}`);
  return { from: read("from"), length: read("length"), lane: read("lane") };
};
/** A block's link in the running order, found by the start of its accessible name: its label. */
const blockLink = (label: string) =>
  screen.getByRole("link", { name: new RegExp(`^${label},`) });
/** The seven days of the running order, Monday first. */
const dayGroups = () =>
  within(
    screen.getByRole("region", { name: en.runningOrder.scrollLabel }),
  ).getAllByRole("group");
const listButton = () => screen.getByRole("button", { name: en.lobbyViewList });

describe("game logo", () => {
  const VERSION = "d".repeat(64);
  const logoOf = (element: Element) =>
    element.querySelector('[data-slot="game-logo"]');

  it("shows each list row's game logo, or its monogram, at the regular size before the label", async () => {
    renderLobbies(
      withLobbies(
        { ...catan, gameId: "game1", gameLogoVersion: VERSION },
        { ...chess, gameId: "game2" },
      ),
    );

    const [withLogo, monogram] = await screen.findAllByRole("listitem");
    expect(logoOf(withLogo)?.getAttribute("data-size")).toBe("regular");
    expect(logoOf(withLogo)?.nextElementSibling?.textContent).toBe("Catan");
    expect(logoOf(withLogo)?.querySelector("img")?.getAttribute("src")).toBe(
      `/api/games/game1/images/logo?v=${VERSION}`,
    );
    expect(logoOf(monogram)?.textContent).toBe("C");
    expect(logoOf(monogram)?.getAttribute("aria-hidden")).toBe("true");
    expect(screen.getByRole("link", { name: "Chess" })).toBeTruthy();
  });

  it("shows no logo on an open lobby or one with another game", async () => {
    renderLobbies(
      withLobbies(
        lobby({ id: "l10", gameId: null, gameName: null }),
        lobby({ id: "l11", gameId: null, gameName: "Kubb" }),
      ),
    );

    const rows = await screen.findAllByRole("listitem");
    expect(rows.map((row) => logoOf(row))).toEqual([null, null]);
  });
});

describe("label and role slots", () => {
  const overwatch = lobby({
    id: "l9",
    gameName: "Overwatch 2",
    modeName: "Competitive",
    activityName: "Control",
    flexCount: 0,
    roleSlots: [{ gameRoleId: "r1", name: "Tank", slots: 1, playerCount: 0 }],
  });
  const full = "Overwatch 2 › Competitive › Control";

  it("shows the label and role slots in the list", async () => {
    renderLobbies({
      listUpcomingLobbies: () => Promise.resolve([overwatch, catan]),
    });

    expect(await screen.findByRole("link", { name: full })).toBeTruthy();
    const slots = screen.getAllByRole("list", { name: en.lobbyRoleSlotsLabel });
    expect(slots).toHaveLength(1);
    expect(slots[0].textContent).toBe("Tank 0/1");
  });

  it("shows the full label in the week view block", async () => {
    renderLobbies({ listUpcomingLobbies: () => Promise.resolve([overwatch]) });
    await screen.findByRole("link", { name: full });
    fireEvent.click(calendarButton());

    expect(within(blockLink(full)).getByText(full)).toBeTruthy();
  });

  it("labels a lobby with no game Open, in the list and the week view", async () => {
    const open = lobby({ id: "l10", gameId: null, gameName: null });
    renderLobbies(withLobbies(open));

    expect(
      await screen.findByRole("link", { name: en.lobbyOpen }),
    ).toBeTruthy();
    fireEvent.click(calendarButton());
    expect(
      within(blockLink(en.lobbyOpen)).getByText(en.lobbyOpen),
    ).toBeTruthy();
  });
});

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

  it("shows the week Monday to Sunday as the running order, each lobby in the row of its day", async () => {
    renderLobbies(withLobbies(catan, chess));
    await screen.findByRole("link", { name: "Catan" });
    fireEvent.click(calendarButton());

    expect(
      screen.getByRole("heading", { level: 3, name: /^Week / }),
    ).toBeTruthy();
    expect(dayGroups()).toHaveLength(7);
    expect(screen.getAllByRole("heading", { level: 4 })).toHaveLength(7);
    expect(within(dayGroups()[3]).getByRole("link")).toBe(blockLink("Catan"));
    expect(dayGroups()[0].textContent).toContain(
      formatWeekdayShort(new Date(2026, 10, 2)),
    );
    expect(blockLink("Catan").getAttribute("href")).toBe(
      "/groups/g1/lobbies/l1",
    );
    expect(blockLink("Catan").getAttribute("aria-label")).toContain(
      "Friday crew",
    );
  });

  it("splits a lobby that crosses midnight over both days and marks the continuation", async () => {
    renderLobbies(withLobbies(chess));
    await screen.findByRole("link", { name: "Chess" });
    fireEvent.click(calendarButton());

    const friday = within(dayGroups()[4]).getByRole("link");
    const saturday = within(dayGroups()[5]).getByRole("link");
    expect(friday.getAttribute("aria-label")).toContain("ends next day");
    expect(saturday.getAttribute("aria-label")).toContain(
      "started the day before",
    );
    expect(blockStyle(friday)).toMatchObject({
      from: String(1320 / 1440),
      length: String(120 / 1440),
    });
    expect(blockStyle(saturday)).toMatchObject({
      from: "0",
      length: String(120 / 1440),
    });
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

    const poker = within(dayGroups()[0]).getByRole("link");
    expect(blockStyle(poker)).toMatchObject({ from: "0", length: "0.125" });
    expect(poker.getAttribute("aria-label")).toContain(
      "started the day before",
    );
    fireEvent.click(screen.getByRole("button", { name: en.calendarNextWeek }));
    expect(screen.queryByRole("link", { name: /^Poker,/ })).toBeNull();
  });

  it("places a block by its start and duration, and shows game, time range and spots", async () => {
    renderLobbies(withLobbies(catan, chess));
    await screen.findByRole("link", { name: "Catan" });
    fireEvent.click(calendarButton());

    const block = blockLink("Catan").closest("li")!;
    expect(blockStyle(block)).toMatchObject({
      from: "0.75",
      length: String(120 / 1440),
    });
    expect(block.textContent).toContain(
      en.runningOrder.times(
        formatTime(catan.startsAt),
        formatTime(catan.endsAt),
      ),
    );
    expect(block.textContent).toContain("2/4");
    expect(blockLink("Catan").getAttribute("aria-label")).toContain(
      "2/4 players",
    );
    expect(
      within(dayGroups()[4]).getByRole("link").closest("li")!.textContent,
    ).toContain("3 players");
  });

  it("puts overlapping lobbies of a day in lanes, so none hides another", async () => {
    const overlapping = lobby({
      id: "l3",
      gameName: "Go",
      startsAt: local(5, 19),
      endsAt: local(5, 21),
    });
    renderLobbies(withLobbies(catan, overlapping));
    await screen.findByRole("link", { name: "Catan" });
    fireEvent.click(calendarButton());

    expect(blockStyle(blockLink("Catan"))).toMatchObject({ lane: "0" });
    expect(blockStyle(blockLink("Go"))).toMatchObject({ lane: "1" });
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
    expect(screen.queryByRole("link", { name: /^Risk,/ })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: en.calendarNextWeek }));

    expect(blockLink("Risk")).toBeTruthy();
    expect(screen.queryByRole("link", { name: /^Catan,/ })).toBeNull();
    expect(
      screen.queryByRole("button", { name: /previous|back|this week/i }),
    ).toBeNull();
  });

  it("opens scrolled to the hour of the next lobby", async () => {
    // jsdom does no layout: the axis is 2400 px wide, 100 px an hour, and the view shows less than 12 hours.
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(2400);
    renderLobbies(withLobbies(catan));
    await screen.findByRole("link", { name: "Catan" });

    fireEvent.click(calendarButton());

    expect(
      screen.getByRole("region", { name: en.runningOrder.scrollLabel })
        .scrollLeft,
    ).toBe(18 * 100);
  });

  it("keeps the scroll position when the next week is shown", async () => {
    renderLobbies(withLobbies(catan));
    await screen.findByRole("link", { name: "Catan" });
    fireEvent.click(calendarButton());
    const scroll = () =>
      screen.getByRole("region", { name: en.runningOrder.scrollLabel });
    scroll().scrollLeft = 1234;

    fireEvent.click(screen.getByRole("button", { name: en.calendarNextWeek }));

    expect(scroll().scrollLeft).toBe(1234);
  });

  it("draws the Now line at the current minute in today's row only, hidden from screen readers", async () => {
    renderLobbies(withLobbies(catan));
    await screen.findByRole("link", { name: "Catan" });
    fireEvent.click(calendarButton());

    const lines = () =>
      document.querySelectorAll<HTMLElement>(".running-order__now");
    expect(lines()).toHaveLength(1);
    const [line] = lines();
    expect(dayGroups()[2].contains(line)).toBe(true);
    expect(line.style.getPropertyValue("--now")).toBe("0.5");
    expect(line.closest("[aria-hidden='true']")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: en.calendarNextWeek }));
    expect(lines()).toHaveLength(0);
  });

  it("shows the same empty text as the list", async () => {
    renderLobbies();
    await screen.findByText(en.runningOrder.nothingBooked);
    fireEvent.click(calendarButton());

    expect(screen.getByText(en.runningOrder.nothingBooked)).toBeTruthy();
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

  // The new lobby is in the list, so it confirms itself (REQ-0022, place 7).
  it("closes after a save and refreshes the list, with no toast and no inline text", async () => {
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

    await waitFor(() => expect(dialog()).toBeNull());
    expect(client.listUpcomingLobbies).toHaveBeenCalledTimes(2);
    expect(document.activeElement).toBe(openButton());
    await settleToasts();
    expect(screen.queryByText(en.lobbyCreated)).toBeNull();
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
  const dayButton = (day: number) =>
    screen.getByRole("button", {
      name: en.runningOrder.createOn(formatWeekday(new Date(2026, 10, day))),
    });
  /** The pointer area over a day's future time: hidden from screen readers, so found by its class. */
  const createArea = (day: number) =>
    dayButton(day)
      .closest('[role="group"]')!
      .querySelector<HTMLElement>(".running-order__create")!;
  const value = async (label: string) =>
    (await screen.findByLabelText<HTMLInputElement>(label)).value;

  async function showCalendar() {
    renderLobbies(withLobbies(catan));
    await screen.findByRole("link", { name: "Catan" });
    fireEvent.click(calendarButton());
  }

  /** Creates `created` from Friday's button of the calendar; the reloaded list then has it. */
  async function createFromCalendar(created: Lobby) {
    const listUpcomingLobbies = vi
      .fn<ApiClient["listUpcomingLobbies"]>()
      .mockResolvedValueOnce([catan])
      .mockResolvedValue([catan, created]);
    renderLobbies({
      listUpcomingLobbies,
      createLobby: vi.fn(() => Promise.resolve(created)),
    });
    await screen.findByRole("link", { name: "Catan" });
    fireEvent.click(calendarButton());
    const day = dayButton(6);
    fireEvent.click(day);
    fireEvent.change(await screen.findByLabelText(en.lobbyGameLabel), {
      target: { value: "g-catan" },
    });

    fireEvent.click(
      within(dialog()!).getByRole("button", { name: en.lobbyCreateSubmit }),
    );
    await waitFor(() => expect(dialog()).toBeNull());
    await waitFor(() => expect(listUpcomingLobbies).toHaveBeenCalledTimes(2));
    return day;
  }

  it("closes after a save with focus back on the day's button, and a lobby in the week shown gets no toast", async () => {
    const day = await createFromCalendar(
      lobby({
        id: "l3",
        gameName: "Catan",
        startsAt: local(6, 18),
        endsAt: local(6, 20),
      }),
    );

    expect(document.activeElement).toBe(day);
    await settleToasts();
    expect(screen.queryByText(en.lobbyCreated)).toBeNull();
  });

  it("confirms with a toast a lobby that the reloaded list has outside the week shown", async () => {
    await createFromCalendar(
      lobby({
        id: "l3",
        gameName: "Catan",
        startsAt: local(13, 18),
        endsAt: local(13, 20),
      }),
    );

    await findToast(en.lobbyCreated);
    expect(screen.getAllByText(en.lobbyCreated)).toHaveLength(1);
  });

  it("opens the form from a later day's button with its date, 18:00 and an end two hours later", async () => {
    await showCalendar();

    fireEvent.click(dayButton(6));

    expect(await value(en.lobbyDateLabel)).toBe("2026-11-06");
    expect(await value(en.lobbyStartLabel)).toBe("18:00");
    expect(await value(en.lobbyEndLabel)).toBe("20:00");
  });

  it("opens the form from today's button at the next half hour", async () => {
    await showCalendar();

    fireEvent.click(dayButton(4));

    expect(await value(en.lobbyDateLabel)).toBe("2026-11-04");
    expect(await value(en.lobbyStartLabel)).toBe("12:30");
    expect(await value(en.lobbyEndLabel)).toBe("14:30");
  });

  it("opens the form with date and start rounded down to the half hour, and an end two hours later, from a click on the time", async () => {
    await showCalendar();
    const friday = createArea(6);
    // The day is 1440 px wide, so one px is one minute.
    vi.spyOn(friday, "getBoundingClientRect").mockReturnValue({
      left: 100,
      width: 1440,
    } as DOMRect);

    fireEvent.click(friday, { clientX: 100 + 21 * 60 + 50 });

    expect(await value(en.lobbyDateLabel)).toBe("2026-11-06");
    expect(await value(en.lobbyStartLabel)).toBe("21:30");
    expect(await value(en.lobbyEndLabel)).toBe("23:30");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(document.activeElement).toBe(dayButton(6));
  });

  it("makes only the time from the next half hour on clickable today", async () => {
    await showCalendar();
    const today = createArea(4);
    // Now is 12:00, so the area starts at 12:30 (minute 750), and a click 90 px into its 690 px is at 14:00.
    expect(today.style.getPropertyValue("--from")).toBe(String(750 / 1440));
    vi.spyOn(today, "getBoundingClientRect").mockReturnValue({
      left: 0,
      width: 690,
    } as DOMRect);

    fireEvent.click(today, { clientX: 90 });

    expect(await value(en.lobbyStartLabel)).toBe("14:00");
  });

  it("does not open from a click on a lobby block, which still links to its page", async () => {
    await showCalendar();
    const block = blockLink("Catan").closest("li")!;

    fireEvent.click(within(block).getByText("2/4"));
    fireEvent.click(blockLink("Catan"));

    expect(dialog()).toBeNull();
  });

  it("has no button and no clickable time on days before today, and returns focus to the day's button on close", async () => {
    await showCalendar();

    const tuesday = dayGroups()[1];
    expect(within(tuesday).queryByRole("button")).toBeNull();
    expect(tuesday.querySelector(".running-order__create")).toBeNull();
    const today = dayButton(4);
    fireEvent.click(today);
    await screen.findByLabelText(en.lobbyGameLabel);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(document.activeElement).toBe(today);
  });
});
