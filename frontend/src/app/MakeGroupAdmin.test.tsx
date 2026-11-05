import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiError, ApiProvider, type Group } from "../api";
import { en } from "../i18n/messages/en";
import { fakeApiClient, testUser } from "../test/fakeApiClient";
import { App } from "./App";

const maja = { userId: testUser.userId, displayName: testUser.displayName };
const sam = { userId: "u2", displayName: "Sam" };

function groupOf(
  viewerRole: "admin" | "member",
  samRole: "admin" | "member" = "member",
): Group {
  return {
    id: "g1",
    name: "Friday crew",
    members: [
      { ...maja, role: viewerRole },
      { ...sam, role: samRole },
    ],
  };
}

function renderGroup(group: Group, overrides = {}) {
  window.history.replaceState(null, "", "/groups/g1");
  const client = fakeApiClient({
    getCurrentUser: () => Promise.resolve(testUser),
    getGroup: vi.fn(() => Promise.resolve(group)),
    ...overrides,
  });
  render(
    <ApiProvider client={client}>
      <App />
    </ApiProvider>,
  );
  return client;
}

const makeButton = () =>
  screen.findByRole("button", { name: en.makeAdminLabel(sam.displayName) });

async function openDialog() {
  fireEvent.click(await makeButton());
  return await screen.findByRole("dialog", {
    name: en.makeAdminHeading(sam.displayName),
  });
}

function confirm(dialog: HTMLElement) {
  fireEvent.click(
    within(dialog).getByRole("button", { name: en.makeAdminSubmit }),
  );
}

describe("making a member group admin", () => {
  it("offers the action to an admin on members who are not admins only", async () => {
    renderGroup(groupOf("admin"));

    await makeButton();
    expect(
      screen.queryByRole("button", {
        name: en.makeAdminLabel(maja.displayName),
      }),
    ).toBeNull();
  });

  it("offers nothing to a member, and nothing on an admin", async () => {
    renderGroup(groupOf("member"));
    await screen.findByText(sam.displayName);
    expect(
      screen.queryByRole("button", { name: /^Make .* a group admin$/ }),
    ).toBeNull();
  });

  it("offers no way to remove an admin role", async () => {
    renderGroup(groupOf("admin", "admin"));
    await screen.findByText(sam.displayName);
    expect(
      screen.queryByRole("button", { name: /^Make .* a group admin$/ }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: /remove/i })).toBeNull();
  });

  it("asks first, with Cancel focused, and says it cannot be undone", async () => {
    const client = renderGroup(groupOf("admin"));
    const dialog = await openDialog();

    expect(document.activeElement).toBe(
      within(dialog).getByRole("button", { name: en.makeAdminKeep }),
    );
    expect(dialog.textContent).toContain(en.makeAdminConfirm);
    expect(client.makeGroupAdmin).not.toHaveBeenCalled();
  });

  it("makes the member admin and reloads the list with the marker", async () => {
    let made = false;
    const client = renderGroup(groupOf("admin"), {
      getGroup: vi.fn(() =>
        Promise.resolve(groupOf("admin", made ? "admin" : "member")),
      ),
      makeGroupAdmin: vi.fn(() => {
        made = true;
        return Promise.resolve();
      }),
    });
    confirm(await openDialog());

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(client.makeGroupAdmin).toHaveBeenCalledWith("g1", sam.userId);
    expect(client.getGroup).toHaveBeenCalledTimes(2);
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: /^Make .* a group admin$/ }),
      ).toBeNull(),
    );
    expect(screen.getAllByText(en.groupAdminMarker)).toHaveLength(2);
  });

  it.each(["not_allowed", "member_not_found"] as const)(
    "shows %s in the dialog and reloads the list",
    async (code) => {
      const client = renderGroup(groupOf("admin"), {
        makeGroupAdmin: vi.fn(() => Promise.reject(new ApiError(403, code))),
      });
      const dialog = await openDialog();

      confirm(dialog);

      expect((await within(dialog).findByRole("alert")).textContent).toBe(
        en.errors[code],
      );
      await waitFor(() => expect(client.getGroup).toHaveBeenCalledTimes(2));
    },
  );

  it("shows the not-found page when the group is gone", async () => {
    renderGroup(groupOf("admin"), {
      getGroup: vi
        .fn()
        .mockResolvedValueOnce(groupOf("admin"))
        .mockRejectedValue(new ApiError(404, "group_not_found")),
      makeGroupAdmin: vi.fn(() =>
        Promise.reject(new ApiError(404, "group_not_found")),
      ),
    });
    confirm(await openDialog());

    await screen.findByRole("heading", { name: en.notFoundHeading });
  });

  it("disables the confirm button while the call runs", async () => {
    renderGroup(groupOf("admin"), {
      makeGroupAdmin: vi.fn(() => new Promise<void>(() => {})),
    });
    const dialog = await openDialog();
    const submit = within(dialog).getByRole("button", {
      name: en.makeAdminSubmit,
    });

    fireEvent.click(submit);

    await waitFor(() => expect(submit).toHaveProperty("disabled", true));
  });

  it("reports an ended session", async () => {
    renderGroup(groupOf("admin"), {
      makeGroupAdmin: vi.fn(() =>
        Promise.reject(new ApiError(401, "unauthenticated")),
      ),
    });
    confirm(await openDialog());

    await screen.findByRole("link", { name: /log in/i });
  });
});
