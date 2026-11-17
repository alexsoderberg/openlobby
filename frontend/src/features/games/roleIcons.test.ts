import { describe, expect, it } from "vitest";
import { en } from "../../i18n/messages/en";
import { ROLE_ICONS, suggestRoleIcon } from "./roleIcons";

describe("suggestRoleIcon", () => {
  it.each([
    ["Tank", "shield"],
    ["Support", "medical-cross"],
    ["Healer", "medical-cross"],
    ["DPS", "dagger"],
    ["Damage", "dagger"],
    ["Sniper", "crosshair"],
    ["Ranged", "crosshair"],
    ["Engineer", "wrench"],
    ["  tank ", "shield"],
    ["HEALER", "medical-cross"],
    ["dPs\t", "dagger"],
  ])("suggests an icon for %j", (name, icon) => {
    expect(suggestRoleIcon(name)).toBe(icon);
  });

  it.each(["", "Scout", "Tanks", "Main tank", "Star", "star", "none", "Other"])(
    "suggests none for %j",
    (name) => {
      expect(suggestRoleIcon(name)).toBe("none");
    },
  );

  it("never suggests star", () => {
    const names = [
      "tank",
      "support",
      "healer",
      "dps",
      "damage",
      "sniper",
      "ranged",
      "engineer",
      "star",
      "other",
    ];
    expect(names.map(suggestRoleIcon)).not.toContain("star");
  });

  it("offers No icon first, then every icon of the catalog once", () => {
    expect(ROLE_ICONS[0]).toBe("none");
    expect([...ROLE_ICONS].sort()).toEqual(Object.keys(en.roleIcon).sort());
  });
});
