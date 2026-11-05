import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiError, ApiProvider } from "../api";
import { en } from "../i18n/messages/en";
import { fakeApiClient, testUser } from "../test/fakeApiClient";
import { App } from "./App";

function renderLoggedIn(path = "/") {
  window.history.replaceState(null, "", path);
  const client = fakeApiClient({
    getCurrentUser: () => Promise.resolve(testUser),
  });
  render(
    <ApiProvider client={client}>
      <App />
    </ApiProvider>,
  );
  return client;
}

describe("moving between pages", () => {
  it("focuses the main area on a page change but not on first load", async () => {
    renderLoggedIn();
    await screen.findByRole("navigation", { name: en.shell.mainNav });
    const main = screen.getByRole("main");
    expect(document.activeElement).not.toBe(main);

    fireEvent.click(screen.getAllByRole("link", { name: en.shell.you })[0]);

    await waitFor(() => expect(document.activeElement).toBe(main));
    expect(window.location.pathname).toBe("/profile");
  });

  it("reloads the group list, then opens a created group without a page load", async () => {
    const client = renderLoggedIn("/groups");
    await screen.findByRole("main");
    const [plus] = screen.getAllByRole("button", {
      name: en.shell.createGroupButton,
    });
    fireEvent.click(plus);
    fireEvent.change(screen.getByRole("textbox", { name: en.groupNameLabel }), {
      target: { value: "Friday crew" },
    });

    fireEvent.click(screen.getByRole("button", { name: en.createGroupSubmit }));

    await waitFor(() => expect(window.location.pathname).toBe("/groups/new"));
    await waitFor(() => expect(client.listGroups).toHaveBeenCalledTimes(2));
  });
});

describe("leaving a group", () => {
  const group = { id: "g1", name: "Friday crew" };
  const groupDetail = {
    ...group,
    members: [
      {
        userId: testUser.userId,
        displayName: testUser.displayName,
        role: "member" as const,
      },
    ],
  };

  function renderGroup(overrides = {}) {
    window.history.replaceState(null, "", "/groups/g1");
    const client = fakeApiClient({
      getCurrentUser: () => Promise.resolve(testUser),
      getGroup: () => Promise.resolve(groupDetail),
      ...overrides,
    });
    render(
      <ApiProvider client={client}>
        <App />
      </ApiProvider>,
    );
    return client;
  }

  async function openDialog() {
    fireEvent.click(await screen.findByRole("button", { name: en.groupLeave }));
    return await screen.findByRole("dialog", {
      name: en.groupLeaveHeading(group.name),
    });
  }

  it("asks first, with Stay focused, and leaves only on confirmation", async () => {
    const client = renderGroup();
    const dialog = await openDialog();
    expect(document.activeElement).toBe(
      within(dialog).getByRole("button", { name: en.groupLeaveKeep }),
    );
    expect(dialog.textContent).toContain(en.groupLeaveConfirm);
    expect(client.leaveGroup).not.toHaveBeenCalled();
  });

  it("goes to the group list with a notice and reloads the groups on success", async () => {
    const client = renderGroup();
    const dialog = await openDialog();

    fireEvent.click(
      within(dialog).getByRole("button", { name: en.groupLeaveSubmit }),
    );

    await waitFor(() => expect(window.location.pathname).toBe("/groups"));
    expect((await screen.findByRole("status")).textContent).toBe(
      en.groupLeft(group.name),
    );
    expect(client.leaveGroup).toHaveBeenCalledWith("g1");
    await waitFor(() => expect(client.listGroups).toHaveBeenCalledTimes(2));
  });

  it("keeps the dialog and the page when upcoming lobbies block leaving", async () => {
    renderGroup({
      leaveGroup: vi.fn(() =>
        Promise.reject(new ApiError(409, "own_upcoming_lobbies_exist")),
      ),
    });
    const dialog = await openDialog();

    fireEvent.click(
      within(dialog).getByRole("button", { name: en.groupLeaveSubmit }),
    );

    expect((await within(dialog).findByRole("alert")).textContent).toBe(
      en.errors.own_upcoming_lobbies_exist,
    );
    expect(window.location.pathname).toBe("/groups/g1");
  });

  it("treats a group that is already gone as left", async () => {
    renderGroup({
      leaveGroup: vi.fn(() =>
        Promise.reject(new ApiError(404, "group_not_found")),
      ),
    });
    const dialog = await openDialog();

    fireEvent.click(
      within(dialog).getByRole("button", { name: en.groupLeaveSubmit }),
    );

    await waitFor(() => expect(window.location.pathname).toBe("/groups"));
  });

  it("disables the confirm button while the call runs", async () => {
    renderGroup({ leaveGroup: vi.fn(() => new Promise<void>(() => {})) });
    const dialog = await openDialog();
    const confirm = within(dialog).getByRole("button", {
      name: en.groupLeaveSubmit,
    });

    fireEvent.click(confirm);

    await waitFor(() => expect(confirm).toHaveProperty("disabled", true));
  });

  it("reports an ended session", async () => {
    renderGroup({
      leaveGroup: vi.fn(() =>
        Promise.reject(new ApiError(401, "unauthenticated")),
      ),
    });
    const dialog = await openDialog();

    fireEvent.click(
      within(dialog).getByRole("button", { name: en.groupLeaveSubmit }),
    );

    await screen.findByRole("link", { name: /log in/i });
  });
});
