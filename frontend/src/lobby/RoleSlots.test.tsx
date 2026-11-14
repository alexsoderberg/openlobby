import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { en } from "../i18n/messages/en";
import { visibleText } from "../test/visibleText";
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
        .map((item) => visibleText(item)),
    ).toEqual(["Tank 0/1", "Healer 1/2", "Damage 2/2", "Flex 1"]);
  });

  it("shows a full slot as a filled badge with the count only, and says full to screen readers", () => {
    render(
      <RoleSlots
        lobby={{
          roleSlots: [
            { gameRoleId: "r1", name: "Tank", slots: 1, playerCount: 1 },
            { gameRoleId: "r2", name: "Healer", slots: 2, playerCount: 1 },
          ],
        }}
      />,
    );

    const [tank, healer] = screen.getAllByRole("listitem");
    // The class carries the filled accent look, which jsdom cannot see.
    expect(tank.classList.contains("badge--full")).toBe(true);
    expect(visibleText(tank)).toBe("Tank 1/1");
    expect(tank.textContent).toBe(`Tank 1/1${en.lobbyRoleSlotFullSuffix}`);
    expect(within(tank).getByText(en.lobbyRoleSlotFullSuffix).className).toBe(
      "visually-hidden",
    );
    // The check follows the count, so it never reads as a role icon before the name.
    expect(tank.lastElementChild?.matches("svg[aria-hidden='true']")).toBe(
      true,
    );
    expect(healer.classList.contains("badge--full")).toBe(false);
    expect(healer.textContent).toBe("Healer 1/2");
    expect(healer.querySelector("svg")).toBeNull();
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
