import type { PreferredGameRole } from "../api";
import { useMessages, type Messages } from "../i18n";

/**
 * "Plays Tank (Ranked), Healer", or with `withGame` "Plays Tank (Ranked) in Overwatch; Healer in WoW" (ADR 0022
 * point 6). The one place that groups the roles into the sentence: the lobby note and the Game chip both use it.
 * The server sends the roles in game order.
 */
export function preferredGameRolesSentence(
  roles: PreferredGameRole[],
  m: Messages["preferredGameRoles"],
  withGame: boolean,
): string {
  const byGame = new Map<string, string[]>();
  for (const role of roles) {
    const name = role.modeName
      ? m.roleWithMode(role.name, role.modeName)
      : role.name;
    byGame.set(role.gameName, [...(byGame.get(role.gameName) ?? []), name]);
  }
  return m.plays(
    [...byGame].map(([game, names]) => ({
      roles: names,
      game: withGame ? game : undefined,
    })),
  );
}

/** The sentence next to a lobby player's name, for the lobby's game, so without game names. Nothing when the
 *  person chose none. */
export function PreferredGameRolesNote({
  roles = [],
}: {
  roles?: PreferredGameRole[];
}) {
  const m = useMessages().preferredGameRoles;
  if (roles.length === 0) return null;
  // The space keeps the name and the note apart for screen readers; the row's flex gap spaces them on screen.
  return (
    <>
      {" "}
      <span className="person-roles">
        {preferredGameRolesSentence(roles, m, false)}
      </span>
    </>
  );
}
