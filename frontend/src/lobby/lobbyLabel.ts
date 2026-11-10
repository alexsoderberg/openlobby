import type { Lobby } from "../api";
import type { Messages } from "../i18n";

type Named = Pick<Lobby, "gameName" | "modeName" | "activityName">;
type Separator = Pick<Messages, "lobbyLabelSeparator">;

const join = (parts: (string | null | undefined)[], m: Separator) =>
  parts.filter(Boolean).join(m.lobbyLabelSeparator);

/** The mode and activity part of the label, for views that may shorten it but never the game name. */
export function lobbyLabelDetail(lobby: Named, m: Separator): string {
  return join([lobby.modeName, lobby.activityName], m);
}

/** "game › mode › activity" with the missing parts left out (ADR 0017 section 4). The one place for this rule. */
export function lobbyLabel(lobby: Named, m: Separator): string {
  return join([lobby.gameName, lobbyLabelDetail(lobby, m)], m);
}
