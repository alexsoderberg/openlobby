import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { en } from "../i18n/messages/en";
import { RoleSlots } from "./RoleSlots";

describe("RoleSlots", () => {
  it("lists each role slot and the flex count", () => {
    render(
      <RoleSlots
        lobby={{
          flexCount: 1,
          roleSlots: [
            { gameRoleId: "r1", name: "Tank", slots: 1, playerCount: 0 },
            { gameRoleId: "r2", name: "Healer", slots: 2, playerCount: 1 },
            { gameRoleId: "r3", name: "Damage", slots: 2, playerCount: 2 },
          ],
        }}
      />,
    );

    const list = screen.getByRole("list", { name: en.lobbyRoleSlotsLabel });
    expect(
      within(list)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["Tank 0/1", "Healer 1/2", "Damage 2/2, full", "Flex 1"]);
  });

  it("leaves out Flex when no player is flex", () => {
    render(
      <RoleSlots
        lobby={{
          flexCount: 0,
          roleSlots: [
            { gameRoleId: "r1", name: "Tank", slots: 1, playerCount: 0 },
          ],
        }}
      />,
    );

    expect(screen.queryByText(/Flex/)).toBeNull();
  });

  it("shows nothing for a lobby without role slots", () => {
    const { container } = render(<RoleSlots lobby={{ roleSlots: [] }} />);
    expect(container.textContent).toBe("");
  });
});
