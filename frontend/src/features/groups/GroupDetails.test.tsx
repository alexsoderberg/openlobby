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
          gameName: "Overwatch",
          modeName: "Competitive",
        },
        {
          gameRoleId: "r2",
          name: "Support",
          gameName: "Overwatch",
          modeName: null,
        },
        { gameRoleId: "r3", name: "Healer", gameName: "WoW", modeName: null },
      ],
    },
    { userId: "u2", displayName: "Kim Berg", role: "member" },
  ],
};

describe("the member list", () => {
  it("shows each member's preferred game roles with the game next to the name", async () => {
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
    const rows = within(members.parentElement!).getAllByRole("listitem");
    expect(rows.map((row) => row.textContent)).toEqual([
      "Maja Lind " +
        en.preferredGameRoles.plays([
          { roles: ["Tank (Competitive)", "Support"], game: "Overwatch" },
          { roles: ["Healer"], game: "WoW" },
        ]),
      "Kim Berg",
    ]);
  });
});
