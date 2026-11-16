import type { Lobby } from "../api";
import { GameLogo } from "../ui";

/**
 * The logo, or monogram, of a lobby's game from the game list. Nothing for an open lobby or "Other", which have no
 * game ID (REQ-0026). A sibling before the label, never part of it. Large: the game is central where a lobby is shown.
 */
export function LobbyGameLogo({ lobby }: { lobby: Lobby }) {
  if (!lobby.gameId || !lobby.gameName) return null;
  return (
    <GameLogo
      gameId={lobby.gameId}
      name={lobby.gameName}
      version={lobby.gameLogoVersion}
      size="large"
    />
  );
}
