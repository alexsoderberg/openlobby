import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, ApiProvider, type ApiClient } from "../../api";
import { en } from "../../i18n/messages/en";
import { fakeApiClient } from "../../test/fakeApiClient";
import { InviteLinks } from "./InviteLinks";

const members = [
  { userId: "u1", displayName: "Maja Lind", role: "admin" as const },
  { userId: "u2", displayName: "Erik Berg", role: "member" as const },
];

const link = {
  id: "l1",
  token: "tok-1",
  createdByUserId: "u1",
  expiresAt: "2026-11-03T20:00:00Z",
  useCount: 3,
  maxUses: 10,
};

/** Button and field names start with the visible text, then name the link they belong to. */
const named = (text: string) => new RegExp(`^${text}`);

function renderLinks(client: ApiClient) {
  const onUnauthenticated = vi.fn();
  const onClose = vi.fn();
  render(
    <ApiProvider client={client}>
      <InviteLinks
        groupId="g1"
        groupName="Friday crew"
        members={members}
        onUnauthenticated={onUnauthenticated}
        onClose={onClose}
      />
    </ApiProvider>,
  );
  return { onUnauthenticated, onClose };
}

function stubClipboard() {
  const writeText = vi.fn<(text: string) => Promise<void>>(() =>
    Promise.resolve(),
  );
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
  return writeText;
}

afterEach(() => {
  Reflect.deleteProperty(navigator, "clipboard");
});

describe("invite link list", () => {
  it("shows the creator's name, the uses and the expiry time of each link", async () => {
    renderLinks(
      fakeApiClient({ listInviteLinks: () => Promise.resolve([link]) }),
    );

    const item = (await screen.findByRole("listitem")) as HTMLElement;
    expect(item.textContent).toContain("Created by Maja Lind");
    expect(item.textContent).toContain("3/10");
    expect(item.querySelector("time")?.getAttribute("dateTime")).toBe(
      "2026-11-03T20:00:00Z",
    );
  });

  it("shows an unknown creator as such when the member is not in the list", async () => {
    renderLinks(
      fakeApiClient({
        listInviteLinks: () =>
          Promise.resolve([{ ...link, createdByUserId: "u9" }]),
      }),
    );

    const item = (await screen.findByRole("listitem")) as HTMLElement;
    expect(item.textContent).toContain(
      `${en.inviteLinkCreatedBy(en.inviteLinkUnknownCreator)}`,
    );
  });

  it("shows the full invite address that the copy button copies", async () => {
    renderLinks(
      fakeApiClient({ listInviteLinks: () => Promise.resolve([link]) }),
    );

    const field = (await screen.findByRole("textbox", {
      name: named(en.inviteLinkUrlLabel),
    })) as HTMLInputElement;
    expect(field.value).toBe(`${window.location.origin}/invite/tok-1`);
  });

  it("names the buttons of two links so that each link can be told apart", async () => {
    const other = { ...link, id: "l2", token: "tok-2", createdByUserId: "u2" };
    renderLinks(
      fakeApiClient({
        listInviteLinks: () => Promise.resolve([link, other]),
      }),
    );

    const copyNames = (
      await screen.findAllByRole("button", { name: named(en.inviteLinkCopy) })
    ).map((button) => button.getAttribute("aria-label"));
    const revokeNames = screen
      .getAllByRole("button", { name: named(en.inviteLinkRevoke) })
      .map((button) => button.getAttribute("aria-label"));

    expect(copyNames[0]).toContain("Maja Lind");
    expect(copyNames[1]).toContain("Erik Berg");
    expect(revokeNames[0]).toContain("Maja Lind");
    expect(revokeNames[1]).toContain("Erik Berg");
  });

  it("the invite uses meter exposes the value as a meter", async () => {
    renderLinks(
      fakeApiClient({ listInviteLinks: () => Promise.resolve([link]) }),
    );

    const meter = await screen.findByRole("meter", { name: /uses/ });
    expect(meter.getAttribute("aria-valuemin")).toBe("0");
    expect(meter.getAttribute("aria-valuenow")).toBe("3");
    expect(meter.getAttribute("aria-valuemax")).toBe("10");
  });

  it("shows an empty state when no link is active", async () => {
    renderLinks(fakeApiClient());

    expect(await screen.findByText(en.inviteLinksEmpty)).toBeTruthy();
  });

  it("sends an expired session to login", async () => {
    const { onUnauthenticated } = renderLinks(
      fakeApiClient({
        listInviteLinks: () =>
          Promise.reject(new ApiError(401, "unauthenticated")),
      }),
    );

    await waitFor(() => expect(onUnauthenticated).toHaveBeenCalledOnce());
  });
});

describe("invite popover body", () => {
  it("names the group in the heading and closes with the Close button", async () => {
    const { onClose } = renderLinks(fakeApiClient());
    await screen.findByText(en.inviteLinksEmpty);

    expect(
      screen.getByRole("heading", { name: en.inviteHeading("Friday crew") }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: en.inviteClose }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe("create invite link", () => {
  it("creates a link with the default of 1 use", async () => {
    const client = fakeApiClient();
    renderLinks(client);
    await screen.findByText(en.inviteLinksEmpty);

    expect(
      (
        screen.getByRole("combobox", {
          name: en.inviteMaxUsesLabel,
        }) as HTMLSelectElement
      ).value,
    ).toBe("1");
    fireEvent.click(
      screen.getByRole("button", { name: en.createInviteLinkSubmit }),
    );

    await waitFor(() =>
      expect(client.createInviteLink).toHaveBeenCalledWith("g1", 1),
    );
  });

  it("creates a link with the chosen number of uses and shows the list again", async () => {
    const listInviteLinks = vi
      .fn<ApiClient["listInviteLinks"]>()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ ...link, maxUses: 3, useCount: 0 }]);
    const client = fakeApiClient({ listInviteLinks });
    renderLinks(client);
    await screen.findByText(en.inviteLinksEmpty);

    fireEvent.change(
      screen.getByRole("combobox", { name: en.inviteMaxUsesLabel }),
      { target: { value: "3" } },
    );
    fireEvent.click(
      screen.getByRole("button", { name: en.createInviteLinkSubmit }),
    );

    await waitFor(() =>
      expect(client.createInviteLink).toHaveBeenCalledWith("g1", 3),
    );
    expect(await screen.findByText(en.inviteLinkCreated)).toBeTruthy();
    expect(await screen.findByText("0/3")).toBeTruthy();
  });

  it("shows the server's error for the number of uses", async () => {
    renderLinks(
      fakeApiClient({
        createInviteLink: () =>
          Promise.reject(new ApiError(400, "invalid_max_uses")),
      }),
    );
    await screen.findByText(en.inviteLinksEmpty);

    fireEvent.click(
      screen.getByRole("button", { name: en.createInviteLinkSubmit }),
    );

    expect((await screen.findByRole("alert")).textContent).toBe(
      en.errors.invalid_max_uses,
    );
  });
});

describe("copy invite link", () => {
  it("copies the full invite address and confirms it", async () => {
    const writeText = stubClipboard();
    renderLinks(
      fakeApiClient({ listInviteLinks: () => Promise.resolve([link]) }),
    );

    fireEvent.click(
      await screen.findByRole("button", { name: named(en.inviteLinkCopy) }),
    );

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        `${window.location.origin}/invite/tok-1`,
      ),
    );
    expect(await screen.findByText(en.inviteLinkCopied)).toBeTruthy();
  });

  it("copy confirmation still lands in the persistent status region", async () => {
    stubClipboard();
    renderLinks(
      fakeApiClient({ listInviteLinks: () => Promise.resolve([link]) }),
    );
    const regions = await screen.findAllByRole("status");

    fireEvent.click(
      await screen.findByRole("button", { name: named(en.inviteLinkCopy) }),
    );

    const confirmation = await screen.findByText(en.inviteLinkCopied);
    expect(regions.some((region) => region.contains(confirmation))).toBe(true);
  });

  it.each([
    ["copy", en.inviteLinkCopied, undefined],
    ["failure", en.inviteLinkCopyFailed, new Error("denied")],
  ])(
    "announces a repeated copy (%s) again as a new message in the status region",
    async (_, text, failure) => {
      const writeText = stubClipboard();
      if (failure) writeText.mockRejectedValue(failure);
      renderLinks(
        fakeApiClient({ listInviteLinks: () => Promise.resolve([link]) }),
      );

      fireEvent.click(
        await screen.findByRole("button", { name: named(en.inviteLinkCopy) }),
      );
      const first = await screen.findByText(text);
      const region = first.closest('[role="status"]');

      fireEvent.click(
        screen.getByRole("button", { name: named(en.inviteLinkCopy) }),
      );

      await waitFor(() => {
        const second = screen.getByText(text);
        expect(second).not.toBe(first);
        expect(region?.contains(second)).toBe(true);
      });
    },
  );

  it("shows a message when the browser cannot copy", async () => {
    const writeText = stubClipboard();
    writeText.mockRejectedValueOnce(new Error("denied"));
    renderLinks(
      fakeApiClient({ listInviteLinks: () => Promise.resolve([link]) }),
    );

    fireEvent.click(
      await screen.findByRole("button", { name: named(en.inviteLinkCopy) }),
    );

    expect(await screen.findByText(en.inviteLinkCopyFailed)).toBeTruthy();
  });
});

describe("revoke invite link", () => {
  it("revokes the link after confirmation and shows the list again", async () => {
    const listInviteLinks = vi
      .fn<ApiClient["listInviteLinks"]>()
      .mockResolvedValueOnce([link])
      .mockResolvedValueOnce([]);
    const client = fakeApiClient({ listInviteLinks });
    renderLinks(client);

    fireEvent.click(
      await screen.findByRole("button", { name: named(en.inviteLinkRevoke) }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: named(en.inviteLinkRevokeSubmit) }),
    );

    await waitFor(() =>
      expect(client.revokeInviteLink).toHaveBeenCalledWith("g1", "l1"),
    );
    expect(await screen.findByText(en.inviteLinksEmpty)).toBeTruthy();
    expect(await screen.findByText(en.inviteLinkRevoked)).toBeTruthy();
  });

  it("keeps the link when the confirmation is cancelled", async () => {
    const client = fakeApiClient({
      listInviteLinks: () => Promise.resolve([link]),
    });
    renderLinks(client);

    fireEvent.click(
      await screen.findByRole("button", { name: named(en.inviteLinkRevoke) }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: named(en.inviteLinkKeep) }),
    );

    expect(client.revokeInviteLink).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("button", { name: named(en.inviteLinkRevokeSubmit) }),
    ).toBeNull();
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: named(en.inviteLinkRevoke) }),
      ),
    );
  });

  it("refreshes the list when the link is no longer active", async () => {
    const listInviteLinks = vi
      .fn<ApiClient["listInviteLinks"]>()
      .mockResolvedValueOnce([link])
      .mockResolvedValueOnce([]);
    renderLinks(
      fakeApiClient({
        listInviteLinks,
        revokeInviteLink: () =>
          Promise.reject(new ApiError(404, "invite_invalid")),
      }),
    );

    fireEvent.click(
      await screen.findByRole("button", { name: named(en.inviteLinkRevoke) }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: named(en.inviteLinkRevokeSubmit) }),
    );

    expect((await screen.findByRole("alert")).textContent).toBe(
      en.errors.invite_invalid,
    );
    await waitFor(() => expect(listInviteLinks).toHaveBeenCalledTimes(2));
  });

  it("shows the denial when the member may not revoke the link", async () => {
    renderLinks(
      fakeApiClient({
        listInviteLinks: () => Promise.resolve([link]),
        revokeInviteLink: () =>
          Promise.reject(new ApiError(403, "not_allowed")),
      }),
    );

    fireEvent.click(
      await screen.findByRole("button", { name: named(en.inviteLinkRevoke) }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: named(en.inviteLinkRevokeSubmit) }),
    );

    expect((await screen.findByRole("alert")).textContent).toBe(
      en.errors.not_allowed,
    );
    expect(
      within(screen.getByRole("listitem")).getByText(/Created by/),
    ).toBeTruthy();
  });
});
