import type { PreferredGameRole, RoleIcon } from "../../api";
import { useMessages } from "../../i18n";
import { preferredGameRolesSentence } from "../../lobby";
import { AnchoredPopover, GameLogo, Icon } from "../../ui";

type ShownIcon = Exclude<RoleIcon, "none">;

/** Each role icon once, then the name of each role without one, once ignoring case (ADR 0022 Amendment
 *  2026-11-17 point 3). Mode names are never shown. */
function visibleTokens(roles: PreferredGameRole[]) {
  const icons = new Set<ShownIcon>();
  const names = new Map<string, string>();
  for (const role of roles) {
    if (role.roleIcon && role.roleIcon !== "none") icons.add(role.roleIcon);
    else if (!names.has(role.name.toLowerCase()))
      names.set(role.name.toLowerCase(), role.name);
  }
  return { icons: [...icons], names: [...names.values()] };
}

/**
 * One game of a member's preferred game roles in the Member list: the logo or monogram and the role icons, with
 * the full sentence as the chip's name and in its Popover. The game name is not shown as text here, the one
 * exception to the REQ-0026 rule (REQ-0021 Amendment 2026-11-17).
 */
export function GameChip({ roles }: { roles: PreferredGameRole[] }) {
  const sentence = preferredGameRolesSentence(
    roles,
    useMessages().preferredGameRoles,
    true,
  );
  const [{ gameId, gameName, gameLogoVersion }] = roles;
  const { icons, names } = visibleTokens(roles);
  return (
    <AnchoredPopover triggerLabel={sentence} content={sentence}>
      <span className="game-chip" aria-hidden="true">
        <GameLogo
          gameId={gameId ?? ""}
          name={gameName}
          version={gameLogoVersion}
        />
        {icons.map((icon) => (
          <Icon key={icon} name={icon} className="game-chip__icon" />
        ))}
        {names.length > 0 && <span>{names.join(", ")}</span>}
      </span>
    </AnchoredPopover>
  );
}

/** A member's Game chips, one per game in the order the server sends the roles; nothing without roles. */
export function GameChips({ roles = [] }: { roles?: PreferredGameRole[] }) {
  // The contract leaves gameId optional for old fixtures; the server always sends it, so the name never keys.
  const byGame = new Map<string, PreferredGameRole[]>();
  for (const role of roles) {
    const key = role.gameId ?? role.gameName;
    byGame.set(key, [...(byGame.get(key) ?? []), role]);
  }
  if (byGame.size === 0) return null;
  return (
    <span className="game-chips">
      {[...byGame].map(([key, gameRoles]) => (
        <GameChip key={key} roles={gameRoles} />
      ))}
    </span>
  );
}
