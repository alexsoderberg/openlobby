import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiProvider, type Group } from "../../api";
import { en } from "../../i18n/messages/en";
import { fakeApiClient, testUser } from "../../test/fakeApiClient";
import { GroupDetails } from "./GroupDetails";

const group: Group = {
  id: "g1",
  name: "Friday crew",
  members: [
    {
      userId: testUser.userId,
      displayName: "Maja Lind",
      role: "member",
      preferredGameRoles: [
        {
          gameRoleId: "r1",
          name: "Tank",
          gameId: "ow",
          gameName: "Overwatch",
          modeName: "Competitive",
        },
        {
          gameRoleId: "r2",
          name: "Support",
          gameId: "ow",
          gameName: "Overwatch",
          modeName: null,
        },
        {
          gameRoleId: "r3",
          name: "Healer",
          gameId: "wow",
          gameName: "WoW",
          modeName: null,
        },
      ],
    },
    { userId: "u2", displayName: "Kim Berg", role: "member" },
  ],
};

describe("the member list", () => {
  it("shows each member's preferred game roles as one Game chip per game, and none for a member without them", async () => {
    render(
      <ApiProvider client={fakeApiClient()}>
        <GroupDetails
          state={{ status: "loaded", group }}
          viewerId={testUser.userId}
          onRetry={vi.fn()}
          onRefresh={vi.fn()}
          onUnauthenticated={vi.fn()}
        />
      </ApiProvider>,
    );

    const members = await screen.findByRole("heading", {
      name: en.membersHeading,
    });
    const [maja, kim] = within(members.closest("section")!).getAllByRole(
      "listitem",
    );
    expect(
      within(maja)
        .getAllByRole("button")
        .map((chip) => chip.getAttribute("aria-label")),
    ).toEqual([
      en.preferredGameRoles.plays([
        { roles: ["Tank (Competitive)", "Support"], game: "Overwatch" },
      ]),
      en.preferredGameRoles.plays([{ roles: ["Healer"], game: "WoW" }]),
    ]);
    expect(maja.textContent).not.toContain("Overwatch");
    expect(within(kim).queryAllByRole("button")).toHaveLength(0);
    expect(within(kim).getByText("Kim Berg")).toBeTruthy();
  });

  it("puts the members in the side column, after the lobbies (REQ-0025)", async () => {
    render(
      <ApiProvider client={fakeApiClient()}>
        <GroupDetails
          state={{ status: "loaded", group }}
          viewerId={testUser.userId}
          onRetry={vi.fn()}
          onRefresh={vi.fn()}
          onUnauthenticated={vi.fn()}
        />
      </ApiProvider>,
    );

    const members = await screen.findByRole("heading", {
      name: en.membersHeading,
    });
    const lobbies = screen.getByRole("heading", { name: en.lobbiesHeading });
    expect(members.closest(".side-column")).not.toBeNull();
    expect(lobbies.closest(".side-column")).toBeNull();
    expect(lobbies.compareDocumentPosition(members)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });
});
