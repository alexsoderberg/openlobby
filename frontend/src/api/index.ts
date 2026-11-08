export type {
  ApiClient,
  ApiErrorCode,
  AuthUser,
  CreateLobbyInput,
  Game,
  Genre,
  GameInput,
  Group,
  GroupSummary,
  InviteInfo,
  InviteLink,
  Lobby,
  LobbyDetail,
} from "./client";
export {
  ApiError,
  DEFAULT_MAX_PLAYERS_LIMIT,
  DEFAULT_MAX_PLAYERS_MIN,
  GAME_NAME_MAX_LENGTH,
  GROUP_NAME_MAX_LENGTH,
  INVITE_MAX_USES_DEFAULT,
  INVITE_MAX_USES_LIMIT,
  RESERVED_GAME_NAME,
  errorCodeOf,
  isUnauthenticated,
  loginUrl,
} from "./client";
export { ApiProvider, useApi } from "./ApiProvider";
export { createHttpApiClient } from "./httpApiClient";
export {
  INVALID_CAPACITY,
  INVALID_GAME,
  INVALID_GENRE,
  isGameNameLength,
  parseMaxPlayers,
  trimLikeServer,
  type ChangeResult,
} from "./inputRules";
