import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiError, ApiProvider, type ApiClient } from "../api";
import { en } from "../i18n/messages/en";
import { fakeApiClient, testUser } from "../test/fakeApiClient";
import { App } from "./App";

const START_LOGIN_HREF = "/api/auth/login?returnTo=%2F";

function renderAt(client: ApiClient, path: string, search = "") {
  window.history.replaceState(null, "", `${path}${search}`);
  return render(
    <ApiProvider client={client}>
      <App />
    </ApiProvider>,
  );
}

function loggedInClient(overrides: Partial<ApiClient> = {}) {
  return fakeApiClient({
    getCurrentUser: () => Promise.resolve(testUser),
    ...overrides,
  });
}

describe("logged out", () => {
  it("shows the Discord login button and no group data", async () => {
    const client = fakeApiClient();
    renderAt(client, "/");

    const login = await screen.findByRole("link", {
      name: en.logInWithDiscord,
    });
    expect(login.getAttribute("href")).toBe(START_LOGIN_HREF);
    expect(client.listGroups).not.toHaveBeenCalled();
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("sends a protected page to login with returnTo set to that page", async () => {
    renderAt(fakeApiClient(), "/invite/abc123");

    const login = await screen.findByRole("link", {
      name: en.logInWithDiscord,
    });
    expect(login.getAttribute("href")).toBe(
      "/api/auth/login?returnTo=%2Finvite%2Fabc123",
    );
  });

  it("keeps the query string in returnTo but drops loginError from it and from the address bar", async () => {
    renderAt(fakeApiClient(), "/invite/abc123", "?x=1&loginError=login_failed");

    const login = await screen.findByRole("link", {
      name: en.logInWithDiscord,
    });
    expect(login.getAttribute("href")).toBe(
      "/api/auth/login?returnTo=%2Finvite%2Fabc123%3Fx%3D1",
    );
    expect(window.location.search).toBe("?x=1");
  });

  it("shows the denied-login message and stays logged out", async () => {
    renderAt(fakeApiClient(), "/", "?loginError=login_denied");

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe(en.loginErrors.login_denied);
    expect(
      screen.getByRole("link", { name: en.logInWithDiscord }),
    ).toBeTruthy();
  });

  it("shows the generic login-failed message", async () => {
    renderAt(fakeApiClient(), "/", "?loginError=login_failed");

    expect((await screen.findByRole("alert")).textContent).toBe(
      en.loginErrors.login_failed,
    );
  });

  it("removes the login result from the address bar after showing it", async () => {
    renderAt(fakeApiClient(), "/", "?loginError=login_denied");

    await screen.findByRole("alert");
    expect(window.location.pathname).toBe("/");
    expect(window.location.search).toBe("");
  });
});

describe("logged in", () => {
  it("shows the dashboard at the start address, with the display name in the top bar", async () => {
    renderAt(
      loggedInClient({
        listGroups: () => Promise.resolve([{ id: "g1", name: "Friday crew" }]),
      }),
      "/",
    );

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: en.dashboard.heading,
      }),
    ).toBeTruthy();
    const profile = screen.getByRole("link", {
      name: en.shell.openProfile(testUser.displayName),
    });
    expect(profile.getAttribute("href")).toBe("/profile");
    expect(
      screen.queryByRole("link", { name: en.logInWithDiscord }),
    ).toBeNull();
  });

  it("shows the group list at /groups", async () => {
    renderAt(
      loggedInClient({
        listGroups: () => Promise.resolve([{ id: "g1", name: "Friday crew" }]),
      }),
      "/groups",
    );

    expect(
      await screen.findByRole("heading", { level: 1, name: en.groupsHeading }),
    ).toBeTruthy();
    const link = await within(screen.getByRole("main")).findByRole("link", {
      name: "Friday crew",
    });
    expect(link.getAttribute("href")).toBe("/groups/g1");
  });

  it("shows the profile at /profile with the name and Log out, and no Game list link to a non-admin", async () => {
    renderAt(loggedInClient(), "/profile");

    expect(await screen.findByRole("button", { name: en.logOut })).toBeTruthy();
    expect(
      within(screen.getByRole("main")).getByText(testUser.displayName),
    ).toBeTruthy();
    expect(screen.queryByRole("link", { name: en.gameListLink })).toBeNull();
  });

  it("logs out and shows the login button again", async () => {
    const client = loggedInClient();
    renderAt(client, "/profile");

    fireEvent.click(await screen.findByRole("button", { name: en.logOut }));

    expect(
      await screen.findByRole("link", { name: en.logInWithDiscord }),
    ).toBeTruthy();
    expect(client.logout).toHaveBeenCalledOnce();
    expect(window.location.pathname).toBe("/");
  });

  it("moves focus to the landing headline after logout", async () => {
    renderAt(loggedInClient(), "/profile");

    fireEvent.click(await screen.findByRole("button", { name: en.logOut }));

    const heading = await screen.findByRole("heading", {
      name: en.landing.headlineLines.join(" "),
    });
    await waitFor(() => expect(document.activeElement).toBe(heading));
  });

  it("keeps the account visible and retries the logout when it fails", async () => {
    const logout = vi
      .fn<ApiClient["logout"]>()
      .mockRejectedValueOnce(new ApiError(503, "service_unavailable"))
      .mockResolvedValueOnce(undefined);
    renderAt(loggedInClient({ logout }), "/profile");

    fireEvent.click(await screen.findByRole("button", { name: en.logOut }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      en.errors.service_unavailable,
    );
    expect(
      within(screen.getByRole("main")).getByText(testUser.displayName),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: en.logOut })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: en.tryAgain }));

    expect(
      await screen.findByRole("link", { name: en.logInWithDiscord }),
    ).toBeTruthy();
    expect(logout).toHaveBeenCalledTimes(2);
  });

  it("shows the invite page on a protected page", async () => {
    renderAt(
      loggedInClient({
        getInvite: () =>
          Promise.resolve({
            groupId: "g1",
            groupName: "Friday crew",
            isMember: false,
          }),
      }),
      "/invite/abc123",
    );

    expect(
      await screen.findByRole("heading", { level: 1, name: "Friday crew" }),
    ).toBeTruthy();
  });

  it("shows one page-level error with a retry when the groups cannot be loaded", async () => {
    const listGroups = vi
      .fn<ApiClient["listGroups"]>()
      .mockRejectedValueOnce(new ApiError(503, "service_unavailable"))
      .mockResolvedValueOnce([]);
    renderAt(loggedInClient({ listGroups }), "/");

    expect((await screen.findByRole("alert")).textContent).toBe(
      en.errors.service_unavailable,
    );
    fireEvent.click(screen.getByRole("button", { name: en.tryAgain }));

    expect(await screen.findByText(en.dashboard.noGroups)).toBeTruthy();
    expect(listGroups).toHaveBeenCalledTimes(2);
  });

  it("sends the user to login with a notice when the session expired", async () => {
    renderAt(
      loggedInClient({
        listGroups: () => Promise.reject(new ApiError(401, "unauthenticated")),
      }),
      "/",
    );

    expect((await screen.findByRole("alert")).textContent).toBe(
      en.sessionExpired,
    );
    expect(
      screen.getByRole("link", { name: en.logInWithDiscord }),
    ).toBeTruthy();
    await waitFor(() =>
      expect(screen.queryByText(testUser.displayName)).toBeNull(),
    );
  });

  it("shows an error when the login status cannot be checked", async () => {
    renderAt(
      fakeApiClient({
        getCurrentUser: () =>
          Promise.reject(new ApiError(0, "service_unavailable")),
      }),
      "/",
    );

    expect((await screen.findByRole("alert")).textContent).toBe(
      en.errors.service_unavailable,
    );
  });
});

describe("group page", () => {
  const members = [
    { userId: "u1", displayName: "Maja Lind", role: "admin" as const },
    { userId: "u2", displayName: "Erik Berg", role: "member" as const },
  ];

  it("sends a group page to login with returnTo set to that page", async () => {
    renderAt(fakeApiClient(), "/groups/g1");

    const login = await screen.findByRole("link", {
      name: en.logInWithDiscord,
    });
    expect(login.getAttribute("href")).toBe(
      "/api/auth/login?returnTo=%2Fgroups%2Fg1",
    );
  });

  it("shows the name and the members, with the admin marked as text", async () => {
    const client = loggedInClient({
      getGroup: vi.fn(() =>
        Promise.resolve({ id: "g1", name: "Friday crew", members }),
      ),
    });
    renderAt(client, "/groups/g1");

    expect(
      await screen.findByRole("heading", { level: 1, name: "Friday crew" }),
    ).toBeTruthy();
    const [maja, erik] = screen.getAllByRole("listitem");
    expect(maja.textContent).toBe(`Maja Lind ${en.groupAdminMarker}`);
    expect(within(maja).getByText(en.groupAdminMarker)).toBeTruthy();
    expect(erik.textContent).toBe("Erik Berg");
    expect(client.getGroup).toHaveBeenCalledWith("g1");
  });

  it("shows the invite links to a member", async () => {
    renderAt(
      loggedInClient({
        getGroup: () =>
          Promise.resolve({ id: "g1", name: "Friday crew", members }),
      }),
      "/groups/g1",
    );

    expect(
      await screen.findByRole("heading", {
        level: 2,
        name: en.inviteLinksHeading,
      }),
    ).toBeTruthy();
  });

  it("shows the not-found page without group content to a non-member", async () => {
    renderAt(
      loggedInClient({
        getGroup: () => Promise.reject(new ApiError(404, "group_not_found")),
      }),
      "/groups/g1",
    );

    expect(
      await screen.findByRole("heading", { name: en.notFoundHeading }),
    ).toBeTruthy();
    expect(within(screen.getByRole("main")).queryByRole("list")).toBeNull();
  });

  it("sends the user to login with a notice when the session expired", async () => {
    renderAt(
      loggedInClient({
        getGroup: () => Promise.reject(new ApiError(401, "unauthenticated")),
      }),
      "/groups/g1",
    );

    expect((await screen.findByRole("alert")).textContent).toBe(
      en.sessionExpired,
    );
    expect(
      screen.getByRole("link", { name: en.logInWithDiscord }),
    ).toBeTruthy();
    await waitFor(() =>
      expect(screen.queryByText(testUser.displayName)).toBeNull(),
    );
  });

  it("shows an error with a retry button when the group cannot be loaded", async () => {
    const getGroup = vi
      .fn<ApiClient["getGroup"]>()
      .mockRejectedValueOnce(new ApiError(503, "service_unavailable"))
      .mockResolvedValueOnce({ id: "g1", name: "Friday crew", members });
    renderAt(loggedInClient({ getGroup }), "/groups/g1");

    expect((await screen.findByRole("alert")).textContent).toBe(
      en.errors.service_unavailable,
    );
    fireEvent.click(screen.getByRole("button", { name: en.tryAgain }));

    expect(
      await screen.findByRole("heading", { level: 1, name: "Friday crew" }),
    ).toBeTruthy();
    expect(getGroup).toHaveBeenCalledTimes(2);
  });
});

describe("unknown page", () => {
  it("shows the not-found page without asking for login", async () => {
    renderAt(fakeApiClient(), "/does-not-exist");

    expect(
      await screen.findByRole("heading", { name: en.notFoundHeading }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("link", { name: en.logInWithDiscord }),
    ).toBeNull();
  });
});

describe("game list page", () => {
  const admin = { ...testUser, isSystemAdmin: true };
  const adminClient = (overrides: Partial<ApiClient> = {}) =>
    loggedInClient({
      getCurrentUser: () => Promise.resolve(admin),
      listGames: vi.fn(() =>
        Promise.resolve([{ id: "g1", name: "Catan", defaultMaxPlayers: 4 }]),
      ),
      ...overrides,
    });

  it("sends a logged-out visitor to login and back to the page", async () => {
    const client = fakeApiClient();
    renderAt(client, "/games");

    const login = await screen.findByRole("link", {
      name: en.logInWithDiscord,
    });
    expect(login.getAttribute("href")).toBe(
      "/api/auth/login?returnTo=%2Fgames",
    );
    expect(client.listGames).not.toHaveBeenCalled();
  });

  it("gives a system admin the link on the profile page and the list", async () => {
    renderAt(adminClient(), "/profile");

    const link = await screen.findByRole("link", { name: en.gameListLink });
    expect(link.getAttribute("href")).toBe("/games");

    cleanup();
    renderAt(adminClient(), "/games");
    expect(await screen.findByText("Catan")).toBeTruthy();
  });

  it("gives a non-admin no link and denies the address without loading the list", async () => {
    const client = loggedInClient();
    renderAt(client, "/profile");
    await screen.findByRole("button", { name: en.logOut });
    expect(screen.queryByRole("link", { name: en.gameListLink })).toBeNull();

    cleanup();
    renderAt(client, "/games");
    expect(await screen.findByText(en.gameListDenied)).toBeTruthy();
    expect(client.listGames).not.toHaveBeenCalled();
  });

  it("denies a user whose admin role the server refuses", async () => {
    renderAt(
      adminClient({
        listGames: () => Promise.reject(new ApiError(403, "not_allowed")),
      }),
      "/games",
    );
    expect(await screen.findByText(en.gameListDenied)).toBeTruthy();
    expect(screen.queryByText("Catan")).toBeNull();
  });
});

describe("lobby page", () => {
  it("shows the lobby with its players, and offers delete to its creator", async () => {
    const lobby = {
      id: "l1",
      gameName: "Catan",
      maxPlayers: 4,
      startsAt: "2026-11-05T18:00:00Z",
      endsAt: "2026-11-05T20:00:00Z",
      createdByUserId: testUser.userId,
      playerCount: 1,
      players: [{ userId: testUser.userId, displayName: testUser.displayName }],
    };
    renderAt(
      loggedInClient({ getLobby: () => Promise.resolve(lobby) }),
      "/groups/g1/lobbies/l1",
    );

    expect(await screen.findByRole("heading", { name: "Catan" })).toBeTruthy();
    expect(screen.getByRole("button", { name: en.lobbyDelete })).toBeTruthy();
  });
});
