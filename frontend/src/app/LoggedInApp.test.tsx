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
import { expectNoToast, findToast } from "../test/toasts";
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
    return await screen.findByRole("alertdialog", {
      name: en.groupLeaveHeading(group.name),
    });
  }

  it("puts Leave group last on the page, after the Member list, not in the header (REQ-0028 item 7)", async () => {
    renderGroup();
    const leave = await screen.findByRole("button", { name: en.groupLeave });
    const heading = screen.getByRole("heading", { level: 1, name: group.name });
    expect(heading.parentElement!.contains(leave)).toBe(false);
    // The side column follows the lobbies in the DOM, so this order holds in both layouts (REQ-0025).
    expect(leave.closest(".side-column")).not.toBeNull();
    const members = within(
      screen
        .getByRole("heading", { name: en.membersHeading })
        .closest("section")!,
    ).getByRole("list");
    expect(members.compareDocumentPosition(leave)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    const main = screen.getByRole("main");
    const focusable = main.querySelectorAll("a[href], button, input, select");
    expect(focusable[focusable.length - 1]).toBe(leave);
  });

  it("asks first, with Stay focused, and leaves only on confirmation", async () => {
    const client = renderGroup();
    const dialog = await openDialog();
    expect(document.activeElement).toBe(
      within(dialog).getByRole("button", { name: en.groupLeaveKeep }),
    );
    expect(dialog.textContent).toContain(en.groupLeaveConfirm);
    expect(client.leaveGroup).not.toHaveBeenCalled();
  });

  async function leaveFromGroupView() {
    let left = false;
    const client = renderGroup({
      listGroups: vi.fn(() => Promise.resolve(left ? [] : [group])),
      leaveGroup: vi.fn(() => {
        left = true;
        return Promise.resolve();
      }),
    });
    const dialog = await openDialog();
    fireEvent.click(
      within(dialog).getByRole("button", { name: en.groupLeaveSubmit }),
    );
    await waitFor(() => expect(window.location.pathname).toBe("/groups"));
    return client;
  }

  it("goes to the group list, confirms with a toast and reloads the groups on success", async () => {
    const client = await leaveFromGroupView();

    await findToast(en.groupLeft(group.name));
    expect(screen.getAllByText(en.groupLeft(group.name))).toHaveLength(1);
    expect(client.leaveGroup).toHaveBeenCalledWith("g1");
    await waitFor(() => expect(client.listGroups).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(screen.queryByRole("link", { name: group.name })).toBeNull(),
    );
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
    await expectNoToast();
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
    // Already gone counts as left, so it is confirmed like a leave.
    await findToast(en.groupLeft(group.name));
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
