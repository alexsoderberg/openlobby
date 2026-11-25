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
import type { ActiveNav } from "./activeNav";
import { AppShell } from "./AppShell";

function renderShell(active: ActiveNav = { section: "groups" }) {
  const onGroupCreated = vi.fn();
  const client = fakeApiClient();
  render(
    <ApiProvider client={client}>
      <AppShell
        user={testUser}
        active={active}
        onGroupCreated={onGroupCreated}
        onUnauthenticated={vi.fn()}
      >
        {(createGroupButton) => (
          <>
            <h1>Page</h1>
            {createGroupButton}
          </>
        )}
      </AppShell>
    </ApiProvider>,
  );
  return { onGroupCreated, client };
}

// The header plus the page puts in its heading (wide screens) and the floating plus of phones. Both exist in
// jsdom, which has no media queries.
const header = () =>
  within(screen.getByRole("main")).getByRole("button", {
    name: en.shell.createGroupButton,
  });
const fab = () => document.querySelector<HTMLElement>(".plus-button--fab");
const dialog = () =>
  screen.queryByRole("dialog", { name: en.createGroupHeading });
const nameField = () =>
  screen.getByRole("textbox", { name: en.groupNameLabel });

describe("landmarks and top bar", () => {
  it("has a banner with the wordmark, the one navigation and the user, and a main area", () => {
    renderShell();

    const banner = within(screen.getByRole("banner"));
    expect(banner.getByRole("navigation", { name: en.shell.mainNav })).toBe(
      screen.getByRole("navigation"),
    );
    expect(banner.getByRole("link", { name: /Open\s*Lobby/ })).toBeTruthy();
    expect(
      banner
        .getByRole("link", { name: en.shell.openProfile(testUser.displayName) })
        .getAttribute("href"),
    ).toBe("/profile");
    expect(banner.getByText(testUser.displayName)).toBeTruthy();
    expect(within(screen.getByRole("main")).getByText("Page")).toBeTruthy();
  });
});

describe("skip link", () => {
  it("is the first keyboard stop and moves focus to the main area", () => {
    renderShell();

    // jsdom has no Tab key: the first element in DOM order that Tab reaches is the first stop.
    const first = document.querySelector<HTMLElement>(
      "a[href], button, input, select, textarea, [tabindex]:not([tabindex='-1'])",
    );
    expect(first).toBe(screen.getByRole("link", { name: en.skipToContent }));

    fireEvent.click(first!);

    expect(document.activeElement).toBe(screen.getByRole("main"));
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
  });

  it("is in the page heading and floating on the Group list, both outside the nav", () => {
    renderShell({ section: "groups" });

    expect(
      within(screen.getByRole("navigation")).queryByRole("button"),
    ).toBeNull();
    expect(header()).toBeTruthy();
    expect(fab()).toBeTruthy();
  });
});

describe("Create group form behind the plus", () => {
  it("is closed at first, opens from the pressed plus with the name field focused", () => {
    renderShell();
    expect(dialog()).toBeNull();
    const plus = header();
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
    const plus = header();

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
    const plus = header();
    fireEvent.click(plus);
    fireEvent.change(nameField(), { target: { value: "Half typed" } });
    fireEvent.keyDown(document, { key: "Escape" });

    fireEvent.click(plus);

    expect((nameField() as HTMLInputElement).value).toBe("");
  });

  it("creates the group with the typed name and hands it over", async () => {
    const { client, onGroupCreated } = renderShell();
    fireEvent.click(header());

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
    fireEvent.click(header());

    fireEvent.click(screen.getByRole("button", { name: en.createGroupSubmit }));

    expect(await screen.findByText(en.errors.invalid_group_name)).toBeTruthy();
    expect(dialog()).toBeTruthy();
  });

  it("keeps Tab and Shift+Tab inside the form", () => {
    renderShell();
    fireEvent.click(header());
    const cancel = screen.getByRole("button", { name: en.cancel });
    const field = nameField();

    cancel.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(field);

    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(cancel);
  });
});
