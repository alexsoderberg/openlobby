import { trimLikeServer, type RoleIcon } from "../../api";

/** The icons an admin can choose, in the order of the choice, "No icon" first. A test keeps it equal to the table. */
export const ROLE_ICONS = [
  "none",
  "shield",
  "medical-cross",
  "dagger",
  "crosshair",
  "wrench",
  "star",
] as const satisfies readonly RoleIcon[];

/**
 * The game role names that suggest each icon, in lower case: a name matches after trim, ignoring case
 * (ADR 0024 section 4). `star` and `none` are only chosen by hand.
 */
const SUGGESTING_NAMES: Record<RoleIcon, readonly string[]> = {
  none: [],
  shield: ["tank"],
  "medical-cross": ["support", "healer"],
  dagger: ["dps", "damage"],
  crosshair: ["sniper", "ranged"],
  wrench: ["engineer"],
  star: [],
};

/** The icon a game role's name suggests, or `none` when no name matches. */
export function suggestRoleIcon(name: string): RoleIcon {
  const key = trimLikeServer(name).toLowerCase();
  return (
    ROLE_ICONS.find((icon) => SUGGESTING_NAMES[icon].includes(key)) ?? "none"
  );
}
