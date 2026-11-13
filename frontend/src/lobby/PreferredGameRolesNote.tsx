import type { PreferredGameRole } from "../api";
import { useMessages } from "../i18n";

/**
 * "Plays Tank (Ranked), Healer" next to a person's name (ADR 0022 point 6). `withGame` names each game, for
 * lists that span games; the server sends the roles in game order. Nothing when the person chose none.
 */
export function PreferredGameRolesNote({
  roles = [],
  withGame = false,
}: {
  roles?: PreferredGameRole[];
  withGame?: boolean;
}) {
  const m = useMessages().preferredGameRoles;
  if (roles.length === 0) return null;
  const byGame = new Map<string, string[]>();
  for (const role of roles) {
    const name = role.modeName
      ? m.roleWithMode(role.name, role.modeName)
      : role.name;
    byGame.set(role.gameName, [...(byGame.get(role.gameName) ?? []), name]);
  }
  const games = [...byGame].map(([game, names]) => ({
    roles: names,
    game: withGame ? game : undefined,
  }));
  // The space keeps the name and the note apart for screen readers; the row's flex gap spaces them on screen.
  return (
    <>
      {" "}
      <span className="person-roles">{m.plays(games)}</span>
    </>
  );
}
