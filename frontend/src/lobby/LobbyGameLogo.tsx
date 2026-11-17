import type { ComponentProps } from "react";
import type { Lobby } from "../api";
import { GameLogo } from "../ui";

/**
 * The logo, or monogram, of a lobby's game from the game list. Nothing for an open lobby or "Other", which have no
 * game ID (REQ-0026). Before the label, never part of its text. Large by default: the game is central on Next up
 * and the lobby page.
 */
export function LobbyGameLogo({
  lobby,
  size = "large",
}: {
  lobby: Lobby;
  size?: ComponentProps<typeof GameLogo>["size"];
}) {
  if (!lobby.gameId || !lobby.gameName) return null;
  return (
    <GameLogo
      gameId={lobby.gameId}
      name={lobby.gameName}
      version={lobby.gameLogoVersion}
      size={size}
    />
  );
}
