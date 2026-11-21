import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiError, ApiProvider, type ApiClient } from "../../api";
import { en } from "../../i18n/messages/en";
import { fakeApiClient } from "../../test/fakeApiClient";
import { GroupListPage } from "./GroupListPage";

const overview = {
  id: "g1",
  name: "Friday crew",
  memberCount: 1,
  members: [{ userId: "u1", displayName: "Maja Lind" }],
  nextLobby: null,
};

function renderPage(client: ApiClient, onUnauthenticated = vi.fn()) {
  render(
    <ApiProvider client={client}>
      <GroupListPage
        createGroupButton={null}
        onUnauthenticated={onUnauthenticated}
      />
    </ApiProvider>,
  );
  return { onUnauthenticated };
}

describe("Group list page", () => {
  it("loads the cards with one request to the Group overviews and no other", async () => {
    const client = fakeApiClient({
      listGroupOverviews: vi.fn(() => Promise.resolve([overview])),
    });
    renderPage(client);

    await screen.findByRole("link", { name: /^Friday crew/ });
    expect(client.listGroupOverviews).toHaveBeenCalledOnce();
    expect(client.listGroups).not.toHaveBeenCalled();
    expect(client.getGroup).not.toHaveBeenCalled();
    expect(client.listUpcomingLobbies).not.toHaveBeenCalled();
  });

  it("shows the cards after a retry that succeeds", async () => {
    const listGroupOverviews = vi
      .fn<ApiClient["listGroupOverviews"]>()
      .mockRejectedValueOnce(new ApiError(503, "service_unavailable"))
      .mockResolvedValueOnce([overview]);
    renderPage(fakeApiClient({ listGroupOverviews }));

    fireEvent.click(await screen.findByRole("button", { name: en.tryAgain }));

    await screen.findByRole("link", { name: /^Friday crew/ });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(listGroupOverviews).toHaveBeenCalledTimes(2);
  });

  it("judges Running at the time the cards arrive, also after a retry", async () => {
    const mountedAt = Date.parse("2026-11-16T18:00:00Z");
    const retriedAt = mountedAt + 2 * 3_600_000;
    const now = vi.spyOn(Date, "now").mockReturnValue(mountedAt);
    const listGroupOverviews = vi
      .fn<ApiClient["listGroupOverviews"]>()
      .mockRejectedValueOnce(new ApiError(503, "service_unavailable"))
      .mockResolvedValueOnce([
        {
          ...overview,
          nextLobby: {
            gameName: "Catan",
            modeName: null,
            activityName: null,
            gameGenre: "strategy",
            startsAt: new Date(mountedAt + 3_600_000).toISOString(),
            endsAt: new Date(retriedAt + 3_600_000).toISOString(),
            playerCount: 2,
            maxPlayers: 4,
          },
        },
      ]);
    renderPage(fakeApiClient({ listGroupOverviews }));
    const retry = await screen.findByRole("button", { name: en.tryAgain });

    now.mockReturnValue(retriedAt);
    fireEvent.click(retry);

    const card = await screen.findByRole("link", { name: /^Friday crew/ });
    expect(card.textContent).toContain(en.dashboard.running);
    now.mockRestore();
  });

  it("hands an expired session over", async () => {
    const { onUnauthenticated } = renderPage(
      fakeApiClient({
        listGroupOverviews: () =>
          Promise.reject(new ApiError(401, "unauthenticated")),
      }),
    );

    await vi.waitFor(() => expect(onUnauthenticated).toHaveBeenCalledOnce());
  });
});
