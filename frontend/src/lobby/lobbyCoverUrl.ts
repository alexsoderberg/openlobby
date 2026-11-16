import { gameImageUrl, type Lobby } from "../api";

/** The URL of the cover of a lobby's game, or nothing when the lobby has no game from the game list or no cover (REQ-0026). */
export const lobbyCoverUrl = (lobby: Lobby) =>
  lobby.gameId && lobby.gameCoverVersion
    ? gameImageUrl(lobby.gameId, "cover", lobby.gameCoverVersion)
    : undefined;
