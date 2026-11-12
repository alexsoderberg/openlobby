import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { en } from "../../i18n/messages/en";
import { testUser } from "../../test/fakeApiClient";
import { GAMES_PATH } from "../games";
import { ProfilePage } from "./ProfilePage";

const headings = () =>
  screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);

describe("ProfilePage", () => {
  it("shows the Account section with the name and no System admin section to a member", () => {
    render(<ProfilePage user={testUser} onLogout={vi.fn()} />);

    expect(headings()).toEqual([en.profileAccountHeading]);
    expect(screen.getByText(testUser.displayName)).toBeTruthy();
    expect(screen.queryByRole("link", { name: en.gameListLink })).toBeNull();
  });

  it("gives a system admin the System admin section with a Game list row, and keeps Log out last", () => {
    const { container } = render(
      <ProfilePage
        user={{ ...testUser, isSystemAdmin: true }}
        onLogout={vi.fn()}
      />,
    );

    expect(headings()).toEqual([
      en.profileAccountHeading,
      en.profileSystemAdminHeading,
    ]);
    const row = screen.getByRole("link", { name: en.gameListLink });
    expect(row.getAttribute("href")).toBe(GAMES_PATH);
    const focusable = container.querySelectorAll("a, button");
    expect(focusable[focusable.length - 1].textContent).toBe(en.logOut);
  });

  it("shows a failed logout next to the button and retries it", () => {
    const onLogout = vi.fn();
    render(
      <ProfilePage
        user={testUser}
        logoutError="service_unavailable"
        onLogout={onLogout}
      />,
    );

    expect(screen.getByRole("alert").textContent).toBe(
      en.errors.service_unavailable,
    );
    fireEvent.click(screen.getByRole("button", { name: en.tryAgain }));
    fireEvent.click(screen.getByRole("button", { name: en.logOut }));
    expect(onLogout).toHaveBeenCalledTimes(2);
  });
});
