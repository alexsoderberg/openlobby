import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiProvider, type Group } from "../../api";
import { groupColorIndex } from "../../groupColor";
import { en } from "../../i18n/messages/en";
import { fakeApiClient, testUser } from "../../test/fakeApiClient";
import { GroupDetails } from "./GroupDetails";
import { GROUPS_PATH } from "./groupPath";

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

function renderGroup(viewed: Group = group) {
  render(
    <ApiProvider client={fakeApiClient()}>
      <GroupDetails
        state={{ status: "loaded", group: viewed }}
        viewerId={testUser.userId}
        onRetry={vi.fn()}
        onRefresh={vi.fn()}
        onUnauthenticated={vi.fn()}
        headerAction={<button type="button">{en.inviteButton}</button>}
        footerAction={<button type="button">{en.groupLeave}</button>}
      />
    </ApiProvider>,
  );
}

describe("the header (REQ-0029 item 5)", () => {
  it("shows the group colour, the name, the member and lobby counts, and the header action before Create lobby", async () => {
    renderGroup();

    const name = screen.getByRole("heading", { level: 1, name: group.name });
    const header = name.closest("header")!;
    expect(
      await within(header).findByText(
        en.groupSummary(en.groupMemberCount(2), en.groupUpcomingLobbyCount(0)),
      ),
    ).toBeTruthy();
    expect(
      within(header)
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual([en.inviteButton, en.lobbyCreateButton]);
    const swatch = header.querySelector("[data-group-color]");
    expect(swatch?.getAttribute("data-group-color")).toBe(
      String(groupColorIndex(group.id)),
    );
    expect(swatch?.getAttribute("aria-hidden")).toBe("true");
  });

  it("links back to the Group list above the header", () => {
    renderGroup();

    expect(
      screen.getByRole("link", { name: en.backToGroups }).getAttribute("href"),
    ).toBe(GROUPS_PATH);
  });
});

describe("the side column", () => {
  it("shows each member's initials before the name, hidden from screen readers", async () => {
    renderGroup();

    const [maja] = within(
      (await screen.findByRole("heading", { name: en.membersHeading })).closest(
        "section",
      )!,
    ).getAllByRole("listitem");
    const avatar = maja.firstElementChild!;
    expect(avatar.textContent).toBe("ML");
    expect(avatar.getAttribute("aria-hidden")).toBe("true");
    expect(avatar.nextElementSibling?.textContent).toBe("Maja Lind");
  });

  it("marks a group admin with a text label", async () => {
    renderGroup({
      ...group,
      members: [{ userId: "u3", displayName: "Ada Holm", role: "admin" }],
    });

    const [ada] = within(
      (await screen.findByRole("heading", { name: en.membersHeading })).closest(
        "section",
      )!,
    ).getAllByRole("listitem");
    expect(within(ada).getByText(en.groupAdminMarker)).toBeTruthy();
  });

  it("ends with the footer action, after the Member list (REQ-0028 item 7)", async () => {
    renderGroup();

    const members = await screen.findByRole("heading", {
      name: en.membersHeading,
    });
    const leave = screen.getByRole("button", { name: en.groupLeave });
    expect(leave.closest(".side-column")).toBe(members.closest(".side-column"));
    expect(leave.previousElementSibling).toBe(members.closest("section"));
    expect(leave.nextElementSibling).toBeNull();
  });
});
