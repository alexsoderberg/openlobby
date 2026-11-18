import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { PreferredGameRole } from "../../api";
import { en } from "../../i18n/messages/en";
import { GameChips } from "./GameChip";

const LOGO_VERSION = "b".repeat(64);
const m = en.preferredGameRoles;

const role = (
  name: string,
  roleIcon: PreferredGameRole["roleIcon"],
  game: { gameId: string; gameName: string; gameLogoVersion?: string | null },
  modeName: string | null = null,
): PreferredGameRole => ({
  gameRoleId: `${game.gameId}-${name}-${modeName}`,
  name,
  roleIcon,
  modeName,
  gameLogoVersion: null,
  ...game,
});

const wow = {
  gameId: "g-wow",
  gameName: "World of Warcraft",
  gameLogoVersion: LOGO_VERSION,
};
const lol = { gameId: "g-lol", gameName: "League of Legends" };

// Server order: WoW first, then LoL. Tank twice (two modes, one icon); Top with null, Jungle with none, a repeat
// of "top" in another case.
const roles = [
  role("Tank", "shield", wow, "Dungeon"),
  role("Tank", "shield", wow, "Raid"),
  role("Healer", "medical-cross", wow, "Raid"),
  role("Top", null, lol),
  role("Jungle", "none", lol),
  role("top", null, lol),
];

const wowSentence = m.plays([
  {
    roles: ["Tank (Dungeon)", "Tank (Raid)", "Healer (Raid)"],
    game: "World of Warcraft",
  },
]);
const lolSentence = m.plays([
  { roles: ["Top", "Jungle", "top"], game: "League of Legends" },
]);

function renderChips(chipRoles = roles) {
  const view = render(
    <>
      <GameChips roles={chipRoles} />
      <p>Outside</p>
    </>,
  );
  return { ...view, chips: screen.queryAllByRole("button") };
}

describe("GameChips", () => {
  it("shows one chip per game, in the order the server sends them, named by the full sentence", () => {
    const { chips } = renderChips();
    expect(chips.map((chip) => chip.getAttribute("aria-label"))).toEqual([
      wowSentence,
      lolSentence,
    ]);
  });

  it("shows each role icon once per game", () => {
    const { chips } = renderChips();
    const icons = [...chips[0].querySelectorAll("[data-icon]")].map((icon) =>
      icon.getAttribute("data-icon"),
    );
    expect(icons).toEqual(["shield", "medical-cross"]);
  });

  it("shows the name of each role without an icon (null or none), once ignoring case", () => {
    const { chips } = renderChips();
    expect(chips[1].querySelector("[data-icon]")).toBeNull();
    expect(chips[1].textContent).toBe("LOTop, Jungle");
  });

  it("shows no game name and no mode name as text", () => {
    const { container } = renderChips();
    for (const text of [
      "World of Warcraft",
      "League of Legends",
      "Dungeon",
      "Raid",
    ])
      expect(container.textContent).not.toContain(text);
  });

  it("hides the logo, the monogram, the icons and the names from assistive technology", () => {
    const { chips } = renderChips();
    for (const chip of chips) {
      const shown = chip.firstElementChild!;
      expect(shown.getAttribute("aria-hidden")).toBe("true");
      expect(chip.children).toHaveLength(1);
    }
    expect(chips[0].querySelector("img")?.getAttribute("alt")).toBe("");
  });

  it("opens the full sentence on a click and closes on Escape with focus back on the chip", async () => {
    const { chips } = renderChips();
    fireEvent.click(chips[0]);
    await waitFor(() => expect(screen.getByText(wowSentence)).toBeTruthy());
    expect(chips[0].getAttribute("aria-expanded")).toBe("true");

    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    await waitFor(() => expect(screen.queryByText(wowSentence)).toBeNull());
    expect(document.activeElement).toBe(chips[0]);
  });

  it("shows the monogram when the logo image fails to load", () => {
    const { chips } = renderChips();
    fireEvent.error(chips[0].querySelector("img")!);
    expect(chips[0].querySelector("img")).toBeNull();
    expect(chips[0].textContent).toBe("WO");
  });

  it("shows nothing for a member with no preferred game roles", () => {
    const { chips, container } = renderChips([]);
    expect(chips).toHaveLength(0);
    expect(container.textContent).toBe("Outside");
  });
});
