import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiProvider } from "../../api";
import { en } from "../../i18n/messages/en";
import { fakeApiClient, testUser } from "../../test/fakeApiClient";
import type { GroupsState } from "../groups";
import type { ActiveNav } from "./activeNav";
import { AppShell } from "./AppShell";

const groups: GroupsState = {
  status: "loaded",
  groups: [
    { id: "g1", name: "Friday crew" },
    { id: "g2", name: "Ranked grind" },
  ],
};

function renderShell(active: ActiveNav = { section: "groups" }) {
  const onGroupCreated = vi.fn();
  const client = fakeApiClient();
  render(
    <ApiProvider client={client}>
      <AppShell
        user={testUser}
        groups={groups}
        active={active}
        onGroupCreated={onGroupCreated}
        onUnauthenticated={vi.fn()}
      >
        <h1>Page</h1>
      </AppShell>
    </ApiProvider>,
  );
  return { onGroupCreated, client };
}

const rail = () =>
  within(screen.getByRole("navigation", { name: en.shell.groupsNav }));
const tabBar = () =>
  within(screen.getByRole("navigation", { name: en.shell.mainNav }));
const plusIn = (nav: ReturnType<typeof rail>) =>
  nav.getByRole("button", { name: en.shell.createGroupButton });
// The floating plus of phones; the rail has its own. Both exist in jsdom, which has no media queries.
const fab = () => document.querySelector<HTMLElement>(".plus-button--fab");
const dialog = () =>
  screen.queryByRole("dialog", { name: en.createGroupHeading });
const nameField = () =>
  screen.getByRole("textbox", { name: en.groupNameLabel });

describe("landmarks and top bar", () => {
  it("has a banner with the wordmark and the user, two navigations and a main area", () => {
    renderShell();

    const banner = within(screen.getByRole("banner"));
    expect(banner.getByRole("link", { name: /Open\s*Lobby/ })).toBeTruthy();
    expect(
      banner
        .getByRole("link", { name: en.shell.openProfile(testUser.displayName) })
        .getAttribute("href"),
    ).toBe("/profile");
    expect(banner.getByText(testUser.displayName)).toBeTruthy();
    expect(screen.getAllByRole("navigation")).toHaveLength(2);
    expect(within(screen.getByRole("main")).getByText("Page")).toBeTruthy();
  });
});

describe("tab bar", () => {
  it("lists Home, Groups and You in that order, with the plus outside the bar", () => {
    renderShell();

    const nav = screen.getByRole("navigation", { name: en.shell.mainNav });
    expect(Array.from(nav.children).map((item) => item.textContent)).toEqual([
      en.shell.home,
      en.shell.groups,
      en.shell.you,
    ]);
    expect(within(nav).queryByRole("button")).toBeNull();
    expect(fab()).toBeTruthy();
  });

  it.each([
    [{ section: "home" }, en.shell.home],
    [{ section: "groups", groupId: "g1" }, en.shell.groups],
    [{ section: "profile" }, en.shell.you],
  ] as [ActiveNav, string][])(
    "marks the active tab for %j",
    (active, label) => {
      renderShell(active);

      const current = tabBar()
        .getAllByRole("link")
        .filter((link) => link.getAttribute("aria-current") === "page");
      expect(current.map((link) => link.textContent)).toEqual([label]);
    },
  );
});

describe("group rail", () => {
  it("has Home, one named link per group, with the active group marked", () => {
    renderShell({ section: "groups", groupId: "g2" });

    expect(
      rail().getByRole("link", { name: en.shell.home }).getAttribute("href"),
    ).toBe("/");
    const crew = rail().getByRole("link", { name: "Friday crew" });
    expect(crew.getAttribute("href")).toBe("/groups/g1");
    expect(crew.getAttribute("aria-current")).toBeNull();
    expect(
      rail()
        .getByRole("link", { name: "Ranked grind" })
        .getAttribute("aria-current"),
    ).toBe("page");
  });

  it("marks Home on the dashboard", () => {
    renderShell({ section: "home" });
    expect(
      rail()
        .getByRole("link", { name: en.shell.home })
        .getAttribute("aria-current"),
    ).toBe("page");
  });
});

describe("where the plus shows", () => {
  it.each([
    [{ section: "home" }],
    [{ section: "groups", groupId: "g1" }],
    [{ section: "profile" }],
    [{}],
  ] as [ActiveNav][])("is absent for %j", (active) => {
    renderShell(active);

    expect(fab()).toBeNull();
    expect(
      screen.queryByRole("button", { name: en.shell.createGroupButton }),
    ).toBeNull();
  });

  it("is in the rail and floating on the Group list", () => {
    renderShell({ section: "groups" });

    expect(plusIn(rail())).toBeTruthy();
    expect(fab()).toBeTruthy();
  });
});

describe("Create group form behind the plus", () => {
  it("is closed at first, opens from the pressed plus with the name field focused", () => {
    renderShell();
    expect(dialog()).toBeNull();
    const plus = plusIn(rail());
    expect(plus.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(plus);

    expect(dialog()).toBeTruthy();
    expect(plus.getAttribute("aria-expanded")).toBe("true");
    expect(document.activeElement).toBe(nameField());
  });

  it("closes on Esc and returns focus to the plus that opened it", () => {
    renderShell();
    const plus = fab() as HTMLElement;
    fireEvent.click(plus);

    fireEvent.keyDown(document, { key: "Escape" });

    expect(dialog()).toBeNull();
    expect(plus.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(plus);
  });

  it("closes on Cancel, on a second press of the plus and on a tap outside, each time returning focus", () => {
    renderShell();
    const plus = plusIn(rail());

    fireEvent.click(plus);
    fireEvent.click(screen.getByRole("button", { name: en.cancel }));
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(plus);

    fireEvent.click(plus);
    fireEvent.click(plus);
    expect(dialog()).toBeNull();

    fireEvent.click(plus);
    fireEvent.click(document.querySelector(".scrim") as HTMLElement);
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(plus);
  });

  it("opens with an empty field each time", () => {
    renderShell();
    const plus = plusIn(rail());
    fireEvent.click(plus);
    fireEvent.change(nameField(), { target: { value: "Half typed" } });
    fireEvent.keyDown(document, { key: "Escape" });

    fireEvent.click(plus);

    expect((nameField() as HTMLInputElement).value).toBe("");
  });

  it("creates the group with the typed name and hands it over", async () => {
    const { client, onGroupCreated } = renderShell();
    fireEvent.click(plusIn(rail()));

    fireEvent.change(nameField(), { target: { value: "Friday crew" } });
    fireEvent.click(screen.getByRole("button", { name: en.createGroupSubmit }));

    await waitFor(() =>
      expect(onGroupCreated).toHaveBeenCalledWith({
        id: "new",
        name: "Friday crew",
      }),
    );
    expect(client.createGroup).toHaveBeenCalledWith("Friday crew");
  });

  it("shows the name error and keeps the form open", async () => {
    renderShell();
    fireEvent.click(plusIn(rail()));

    fireEvent.click(screen.getByRole("button", { name: en.createGroupSubmit }));

    expect(await screen.findByText(en.errors.invalid_group_name)).toBeTruthy();
    expect(dialog()).toBeTruthy();
  });

  it("keeps Tab and Shift+Tab inside the form", () => {
    renderShell();
    fireEvent.click(plusIn(rail()));
    const cancel = screen.getByRole("button", { name: en.cancel });
    const field = nameField();

    cancel.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(field);

    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(cancel);
  });
});
