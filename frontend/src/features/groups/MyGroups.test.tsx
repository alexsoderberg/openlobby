import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiError, type GroupOverview, type NextLobby } from "../../api";
import { groupColorIndex } from "../../groupColor";
import type { LoadView } from "../../hooks";
import { formatDateTime } from "../../i18n";
import { en } from "../../i18n/messages/en";
import { MyGroups } from "./MyGroups";
import type { GroupOverviews } from "./useGroupOverviews";

const NOW = Date.parse("2026-11-16T18:00:00Z");
const hoursFromNow = (hours: number) =>
  new Date(NOW + hours * 3_600_000).toISOString();

const person = (index: number) => ({
  userId: `u${index}`,
  displayName: `Person ${index}`,
});

function nextLobby(overrides: Partial<NextLobby> = {}): NextLobby {
  return {
    gameName: "Overwatch 2",
    modeName: "Competitive",
    activityName: "Control",
    gameGenre: "shooter",
    startsAt: hoursFromNow(2),
    endsAt: hoursFromNow(4),
    playerCount: 3,
    maxPlayers: 5,
    ...overrides,
  };
}

function overview(overrides: Partial<GroupOverview> = {}): GroupOverview {
  return {
    id: "g1",
    name: "Friday crew",
    memberCount: 3,
    members: [person(1), person(2), person(3)],
    nextLobby: nextLobby(),
    ...overrides,
  };
}

function renderGroups(state: LoadView<GroupOverviews>, onRetry = vi.fn()) {
  render(<MyGroups state={state} onRetry={onRetry} />);
  return { onRetry };
}

const loaded = (...overviews: GroupOverview[]) =>
  renderGroups({
    status: "loaded",
    value: { groups: overviews, loadedAt: NOW },
  });

const card = (name: string) =>
  screen.getByRole("link", { name: new RegExp(`^${name}`) });

describe("Group list", () => {
  it("shows the loading text in place of the cards", () => {
    renderGroups({ status: "loading" });
    expect(screen.getByRole("status").textContent).toBe(en.groupsLoading);
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("shows the empty state when the user is in no group", () => {
    loaded();
    expect(screen.getByText(en.groupsEmpty)).toBeTruthy();
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("shows the error with a retry and no card", () => {
    const { onRetry } = renderGroups({
      status: "error",
      code: new ApiError(503, "service_unavailable").code,
    });

    expect(screen.getByRole("alert").textContent).toBe(
      en.errors.service_unavailable,
    );
    expect(screen.queryByRole("link")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: en.tryAgain }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("keeps the order the server sent", () => {
    loaded(
      overview({ id: "g2", name: "board game night" }),
      overview({ id: "g1", name: "Chess club" }),
    );

    const names = screen
      .getAllByRole("listitem")
      .map((item) => item.querySelector(".group-card__name")?.textContent);
    expect(names).toEqual(["board game night", "Chess club"]);
  });
});

describe("Group card", () => {
  it("is one link to the Group view, the only focus stop and control in its card", () => {
    loaded(overview());

    const [item] = screen.getAllByRole("listitem");
    const link = within(item).getByRole("link");
    expect(link.getAttribute("href")).toBe("/groups/g1");
    expect(
      item.querySelectorAll("a, button, input, select, textarea, [tabindex]"),
    ).toHaveLength(1);
  });

  it("reads the name, the member count and the lobby line in one announcement", () => {
    loaded(overview());

    const name = card("Friday crew").textContent;
    expect(name).toContain("Friday crew");
    expect(name).toContain(en.groupMemberCount(3));
    expect(name).toContain("Overwatch 2 › Competitive › Control");
    expect(name).toContain(formatDateTime(hoursFromNow(2)));
    expect(name).toContain(en.lobbyPlayers(3, 5));
  });

  it("writes one member in the singular", () => {
    loaded(overview({ memberCount: 1, members: [person(1)] }));
    expect(card("Friday crew").textContent).toContain("1 member");
  });

  it("shows up to five initials and +N for the members not shown, hidden from screen readers", () => {
    loaded(
      overview({
        memberCount: 8,
        members: [1, 2, 3, 4, 5].map(person),
      }),
    );

    const people = card("Friday crew").querySelector(".group-card__people");
    expect(people?.getAttribute("aria-hidden")).toBe("true");
    expect(people?.querySelectorAll(".initials-icon")).toHaveLength(5);
    expect(people?.textContent).toContain(en.groupMoreMembers(3));
  });

  it("shows no +N when every member is shown", () => {
    loaded(overview());
    expect(card("Friday crew").textContent).not.toContain("+");
  });

  it("shows no member or player names", () => {
    loaded(overview());
    expect(card("Friday crew").textContent).not.toContain("Person");
  });

  it("labels an Open lobby with no max players", () => {
    loaded(
      overview({
        nextLobby: nextLobby({
          gameName: null,
          modeName: null,
          activityName: null,
          gameGenre: null,
          playerCount: 2,
          maxPlayers: null,
        }),
      }),
    );

    const text = card("Friday crew").textContent;
    expect(text).toContain(en.lobbyOpen);
    expect(text).toContain(en.lobbyPlayers(2, null));
  });

  it("shows Running beside the start time for a lobby in progress", () => {
    loaded(
      overview({
        nextLobby: nextLobby({
          startsAt: hoursFromNow(-1),
          endsAt: hoursFromNow(1),
        }),
      }),
    );

    const text = card("Friday crew").textContent;
    expect(text).toContain(en.dashboard.running);
    expect(text).toContain(formatDateTime(hoursFromNow(-1)));
  });

  it("does not show Running before the start", () => {
    loaded(overview());
    expect(card("Friday crew").textContent).not.toContain(en.dashboard.running);
  });

  it("shows No upcoming lobbies for a group without a Next lobby", () => {
    loaded(overview({ nextLobby: null }));
    expect(card("Friday crew").textContent).toContain(
      en.groupNoUpcomingLobbies,
    );
  });

  it("shows no genre theme on the lobby line (REQ-0029 item 10)", () => {
    loaded(overview());

    expect(card("Friday crew").querySelector("[data-genre]")).toBeNull();
    expect(card("Friday crew").textContent).not.toContain(en.genre.shooter);
  });

  it("shows the group colour as a square hidden from screen readers (REQ-0029 item 7)", () => {
    loaded(overview({ id: "g1" }), overview({ id: "g2", name: "Chess club" }));

    const swatchOf = (name: string) =>
      card(name).querySelector("[data-group-color]");
    expect(swatchOf("Friday crew")?.getAttribute("data-group-color")).toBe(
      String(groupColorIndex("g1")),
    );
    expect(swatchOf("Chess club")?.getAttribute("data-group-color")).toBe(
      String(groupColorIndex("g2")),
    );
    expect(swatchOf("Friday crew")?.getAttribute("aria-hidden")).toBe("true");
  });
});
