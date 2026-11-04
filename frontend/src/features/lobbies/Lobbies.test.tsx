import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  ApiProvider,
  type ApiClient,
  type Group,
  type Lobby,
} from "../../api";
import { en } from "../../i18n/messages/en";
import { fakeApiClient, testUser } from "../../test/fakeApiClient";
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

  it("shows the week Monday to Sunday with each lobby on its start day", async () => {
    renderLobbies(withLobbies(catan, chess));
    await screen.findByRole("link", { name: "Catan" });
    fireEvent.click(calendarButton());

    const days = screen.getAllByRole("heading", { level: 4 });
    expect(days).toHaveLength(7);
    const dayOf = (name: string) =>
      screen.getByRole("link", { name }).closest("li.calendar-day")!;
    expect(dayOf("Catan")).toBe(days[3].closest("li"));
    expect(dayOf("Chess")).toBe(days[4].closest("li"));
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

    const monday = screen
      .getAllByRole("heading", { level: 4 })[0]
      .closest("li");
    const item = screen
      .getByRole("link", { name: "Poker" })
      .closest("li.calendar-lobby")!;
    expect(monday?.contains(item)).toBe(true);
    expect(item.textContent).toContain(en.lobbyEndsNextDay);
    fireEvent.click(screen.getByRole("button", { name: en.calendarNextWeek }));
    expect(screen.queryByRole("link", { name: "Poker" })).toBeNull();
  });

  it("shows spots like the list and marks a lobby that ends the next day", async () => {
    renderLobbies(withLobbies(catan, chess));
    await screen.findByRole("link", { name: "Catan" });
    fireEvent.click(calendarButton());

    const catanItem = screen
      .getByRole("link", { name: "Catan" })
      .closest("li")!;
    const chessItem = screen
      .getByRole("link", { name: "Chess" })
      .closest("li")!;
    expect(catanItem.textContent).toContain("2/4 players");
    expect(catanItem.textContent).not.toContain(en.lobbyEndsNextDay);
    expect(chessItem.textContent).toContain("3 players");
    expect(chessItem.textContent).toContain(en.lobbyEndsNextDay);
  });

  it("shows overlapping lobbies side by side in one group", async () => {
    const overlapping = lobby({
      id: "l3",
      gameName: "Go",
      startsAt: local(5, 19),
      endsAt: local(5, 21),
    });
    renderLobbies(withLobbies(catan, overlapping));
    await screen.findByRole("link", { name: "Catan" });
    fireEvent.click(calendarButton());

    const together = screen.getByRole("link", { name: "Catan" }).closest("ul")!;
    expect(within(together).getByRole("link", { name: "Go" })).toBeTruthy();
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

  it("opens the form with that day's date, from the day's button", async () => {
    await showCalendar();

    fireEvent.click(dayButton(dayName(6)));

    expect(
      (await screen.findByLabelText<HTMLInputElement>(en.lobbyDateLabel)).value,
    ).toBe("2026-11-06");
    expect(
      (await screen.findByLabelText(en.lobbyStartLabel)).getAttribute("value"),
    ).toBeNull();
  });

  it("opens it from a click on empty space in the day, but a lobby link still goes to its page", async () => {
    await showCalendar();

    fireEvent.click(screen.getByRole("link", { name: "Catan" }));
    expect(dialog()).toBeNull();
    const friday = screen.getAllByRole("heading", { level: 4 })[4];
    fireEvent.click(friday);

    expect(
      (await screen.findByLabelText<HTMLInputElement>(en.lobbyDateLabel)).value,
    ).toBe("2026-11-06");
  });

  it("has no button on days before today, and returns focus to the day's button on close", async () => {
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

    fireEvent.click(screen.getAllByRole("heading", { level: 4 })[0]);
    expect(dialog()).toBeNull();
  });
});
