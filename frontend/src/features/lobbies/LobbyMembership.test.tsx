import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiError, ApiProvider, type ApiClient } from "../../api";
import { en } from "../../i18n/messages/en";
import { fakeApiClient } from "../../test/fakeApiClient";
import { LobbyMembership } from "./LobbyMembership";

const HOUR = 3_600_000;
const open = {
  id: "l1",
  joinedByMe: false,
  endsAt: new Date(Date.now() + HOUR).toISOString(),
};
const ended = new Date(Date.now() - HOUR).toISOString();

function renderMembership(
  lobby: Partial<typeof open> = {},
  overrides: Partial<ApiClient> = {},
  showEnded = false,
) {
  const client = fakeApiClient(overrides);
  const onChanged = vi.fn();
  const onUnauthenticated = vi.fn();
  render(
    <ApiProvider client={client}>
      <LobbyMembership
        groupId="g1"
        lobby={{ ...open, ...lobby }}
        onChanged={onChanged}
        onUnauthenticated={onUnauthenticated}
        showEnded={showEnded}
      />
    </ApiProvider>,
  );
  return { client, onChanged, onUnauthenticated };
}

const join = () => screen.findByRole("button", { name: en.lobbyJoin });
const leave = () => screen.findByRole("button", { name: en.lobbyLeave });
const refuse = (status: number, code: string) =>
  vi.fn(() => Promise.reject(new ApiError(status, code)));

describe("join and leave a lobby", () => {
  it("joins and asks for a fresh lobby", async () => {
    const { client, onChanged } = renderMembership();

    fireEvent.click(await join());

    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(client.joinLobby).toHaveBeenCalledWith("g1", "l1");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("offers leave to a player, also after the end time, and leaves", async () => {
    const { client, onChanged } = renderMembership({
      joinedByMe: true,
      endsAt: ended,
    });

    expect(screen.queryByRole("button", { name: en.lobbyJoin })).toBeNull();
    fireEvent.click(await leave());

    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(client.leaveLobby).toHaveBeenCalledWith("g1", "l1");
  });

  it("shows Ended instead of join for an ended lobby", () => {
    renderMembership({ endsAt: ended }, {}, true);

    expect(screen.getByText(en.lobbyEnded)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("still offers join on a full lobby and answers with the full message", async () => {
    const { onChanged } = renderMembership(
      {},
      { joinLobby: refuse(409, "lobby_full") },
    );

    fireEvent.click(await join());

    expect((await screen.findByRole("alert")).textContent).toBe(
      en.errors.lobby_full,
    );
    expect(onChanged).toHaveBeenCalled();
  });

  it("shows Ended, not an error, when the lobby ended meanwhile", async () => {
    const { onChanged } = renderMembership(
      {},
      { joinLobby: refuse(409, "lobby_has_ended") },
      true,
    );

    fireEvent.click(await join());

    expect(await screen.findByText(en.lobbyEnded)).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(onChanged).toHaveBeenCalled();
  });

  it("reloads the lobby when it ended meanwhile where Ended is not shown", async () => {
    const { onChanged } = renderMembership(
      {},
      { joinLobby: refuse(409, "lobby_has_ended") },
    );

    fireEvent.click(await join());

    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("says the lobby no longer exists when joining a deleted lobby", async () => {
    const { onChanged } = renderMembership(
      {},
      { joinLobby: refuse(404, "lobby_not_found") },
    );

    fireEvent.click(await join());

    expect((await screen.findByRole("alert")).textContent).toBe(en.lobbyGone);
    expect(onChanged).not.toHaveBeenCalled();
  });

  it("lets a deleted lobby disappear when leaving it", async () => {
    const { onChanged } = renderMembership(
      { joinedByMe: true },
      { leaveLobby: refuse(404, "lobby_not_found") },
    );

    fireEvent.click(await leave());

    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it("disables the button while the request is in flight", async () => {
    let finish: () => void = () => undefined;
    const joinLobby = vi.fn(
      () => new Promise<void>((resolve) => (finish = resolve)),
    );
    renderMembership({}, { joinLobby });

    const button = (await join()) as HTMLButtonElement;
    fireEvent.click(button);
    await waitFor(() => expect(button.disabled).toBe(true));
    fireEvent.click(button);
    finish();

    await waitFor(() => expect(button.disabled).toBe(false));
    expect(joinLobby).toHaveBeenCalledTimes(1);
  });

  it("hands an expired session over", async () => {
    const { onUnauthenticated } = renderMembership(
      {},
      { joinLobby: refuse(401, "unauthenticated") },
    );

    fireEvent.click(await join());

    await waitFor(() => expect(onUnauthenticated).toHaveBeenCalled());
  });
});
