import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { en } from "../../i18n/messages/en";
import { testUser } from "../../test/fakeApiClient";
import type { ActiveNav } from "./activeNav";
import { TopBar } from "./TopBar";

const renderTopBar = (active: ActiveNav = {}) =>
  render(<TopBar user={testUser} active={active} />);
const nav = () =>
  within(screen.getByRole("navigation", { name: en.shell.mainNav }));

describe("TopBar", () => {
  it("has the Wordmark, the tabs Home, Groups and You in that order, and is the only nav", () => {
    renderTopBar();

    const banner = within(screen.getByRole("banner"));
    expect(
      banner.getByRole("link", { name: /Open\s*Lobby/ }).getAttribute("href"),
    ).toBe("/");
    expect(screen.getAllByRole("navigation")).toHaveLength(1);
    expect(
      nav()
        .getAllByRole("link")
        .map((tab) => [tab.textContent, tab.getAttribute("href")]),
    ).toEqual([
      [en.shell.home, "/"],
      [en.shell.groups, "/groups"],
      [en.shell.you, "/profile"],
    ]);
  });

  it.each([
    [{ section: "home" }, en.shell.home],
    [{ section: "groups" }, en.shell.groups],
    [{ section: "groups", groupId: "g1" }, en.shell.groups],
    [{ section: "profile" }, en.shell.you],
  ] as [ActiveNav, string][])("marks only the tab of %j", (active, label) => {
    renderTopBar(active);

    const current = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("aria-current") === "page");
    expect(current.map((link) => link.textContent)).toEqual([label]);
  });

  it("marks no tab on a page outside the nav", () => {
    renderTopBar();
    expect(document.querySelector("[aria-current]")).toBeNull();
  });

  it("shows my name and avatar on a link to the You page named for me", () => {
    renderTopBar();

    const me = screen.getByRole("link", {
      name: en.shell.openProfile(testUser.displayName),
    });
    expect(me.getAttribute("href")).toBe("/profile");
    expect(within(me).getByText(testUser.displayName)).toBeTruthy();
    const avatar = me.querySelector(".initials-icon");
    expect(avatar?.textContent).toBe("ML");
    expect(avatar?.getAttribute("aria-hidden")).toBe("true");
  });
});
