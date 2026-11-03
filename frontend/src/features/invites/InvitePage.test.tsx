import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiError, ApiProvider, type ApiClient } from "../../api";
import { en } from "../../i18n/messages/en";
import { fakeApiClient } from "../../test/fakeApiClient";
import { InvitePage } from "./InvitePage";

const TOKEN = "tok-1";
const invitation = { groupId: "g1", groupName: "Friday crew", isMember: false };

function renderInvite(client: ApiClient) {
  const onGroupOpened = vi.fn();
  const onUnauthenticated = vi.fn();
  render(
    <ApiProvider client={client}>
      <InvitePage
        token={TOKEN}
        onGroupOpened={onGroupOpened}
        onUnauthenticated={onUnauthenticated}
      />
    </ApiProvider>,
  );
  return { onGroupOpened, onUnauthenticated };
}

const joinButton = () =>
  screen.getByRole("button", { name: en.joinGroupSubmit });

describe("invite page", () => {
  it("shows the group's name and a join button to a non-member", async () => {
    renderInvite(
      fakeApiClient({ getInvite: () => Promise.resolve(invitation) }),
    );

    expect(
      await screen.findByRole("heading", { level: 1, name: "Friday crew" }),
    ).toBeTruthy();
    expect(joinButton()).toBeTruthy();
  });

  it("joins the group and opens its page", async () => {
    const client = fakeApiClient({
      getInvite: () => Promise.resolve(invitation),
      joinInvite: vi.fn(() =>
        Promise.resolve({ id: "g1", name: "Friday crew" }),
      ),
    });
    const { onGroupOpened } = renderInvite(client);

    fireEvent.click(
      await screen.findByRole("button", { name: en.joinGroupSubmit }),
    );

    await waitFor(() => expect(onGroupOpened).toHaveBeenCalledWith("g1"));
    expect(client.joinInvite).toHaveBeenCalledWith(TOKEN);
  });

  it("opens the group straight away to a member, without a join button", async () => {
    const client = fakeApiClient({
      getInvite: () => Promise.resolve({ ...invitation, isMember: true }),
    });
    const { onGroupOpened } = renderInvite(client);

    await waitFor(() => expect(onGroupOpened).toHaveBeenCalledWith("g1"));
    expect(client.joinInvite).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("button", { name: en.joinGroupSubmit }),
    ).toBeNull();
  });

  it("shows the invalid-link page without any group information", async () => {
    const { onGroupOpened } = renderInvite(
      fakeApiClient({
        getInvite: () => Promise.reject(new ApiError(404, "invite_invalid")),
      }),
    );

    expect(
      await screen.findByRole("heading", { name: en.inviteInvalidHeading }),
    ).toBeTruthy();
    expect(screen.getByText(en.errors.invite_invalid)).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: en.joinGroupSubmit }),
    ).toBeNull();
    expect(document.querySelector("h1")?.textContent).toBe(
      en.inviteInvalidHeading,
    );
    expect(onGroupOpened).not.toHaveBeenCalled();
  });

  it("shows the invalid-link page when the link stops working at the click", async () => {
    const { onGroupOpened } = renderInvite(
      fakeApiClient({
        getInvite: () => Promise.resolve(invitation),
        joinInvite: () => Promise.reject(new ApiError(404, "invite_invalid")),
      }),
    );

    fireEvent.click(
      await screen.findByRole("button", { name: en.joinGroupSubmit }),
    );

    expect(
      await screen.findByRole("heading", { name: en.inviteInvalidHeading }),
    ).toBeTruthy();
    expect(screen.queryByText("Friday crew")).toBeNull();
    expect(onGroupOpened).not.toHaveBeenCalled();
  });

  it("shows a join error and keeps the join button", async () => {
    renderInvite(
      fakeApiClient({
        getInvite: () => Promise.resolve(invitation),
        joinInvite: () =>
          Promise.reject(new ApiError(503, "service_unavailable")),
      }),
    );

    fireEvent.click(
      await screen.findByRole("button", { name: en.joinGroupSubmit }),
    );

    expect((await screen.findByRole("alert")).textContent).toBe(
      en.errors.service_unavailable,
    );
    expect(joinButton()).toBeTruthy();
  });

  it("shows an error with a retry when the invite cannot be loaded", async () => {
    const getInvite = vi
      .fn<ApiClient["getInvite"]>()
      .mockRejectedValueOnce(new ApiError(503, "service_unavailable"))
      .mockResolvedValueOnce(invitation);
    renderInvite(fakeApiClient({ getInvite }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      en.errors.service_unavailable,
    );
    fireEvent.click(screen.getByRole("button", { name: en.tryAgain }));

    expect(
      await screen.findByRole("heading", { level: 1, name: "Friday crew" }),
    ).toBeTruthy();
  });

  it("sends an expired session to login", async () => {
    const { onUnauthenticated } = renderInvite(
      fakeApiClient({
        getInvite: () => Promise.reject(new ApiError(401, "unauthenticated")),
      }),
    );

    await waitFor(() => expect(onUnauthenticated).toHaveBeenCalledOnce());
  });
});
