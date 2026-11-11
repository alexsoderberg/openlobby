import type { components as authComponents } from "./gen/auth";
import type { components as calendarComponents } from "./gen/calendar";

export type AuthUser = authComponents["schemas"]["AuthUser"];
export type GroupSummary = calendarComponents["schemas"]["GroupSummary"];
export type Group = calendarComponents["schemas"]["Group"];
export type Genre = calendarComponents["schemas"]["Genre"];
export type Game = calendarComponents["schemas"]["Game"];
export type InviteLink = calendarComponents["schemas"]["InviteLink"];
export type InviteInfo = calendarComponents["schemas"]["InviteInfo"];
export type Lobby = calendarComponents["schemas"]["Lobby"];
export type LobbyDetail = calendarComponents["schemas"]["LobbyDetail"];
export type CreateLobbyInput =
  calendarComponents["schemas"]["CreateLobbyRequest"];
/** A game role and a mode as the game list sends them. */
export type GameRole = calendarComponents["schemas"]["GameRole"];
export type GameMode = calendarComponents["schemas"]["GameMode"];
/** What a player chooses when joining a lobby with game roles: `{gameRoleId}` or `{flex: true}`. */
export type Seat = calendarComponents["schemas"]["JoinLobbyRequest"];
export type GameRoleInput = calendarComponents["schemas"]["GameRoleInput"];
export type GameModeInput = calendarComponents["schemas"]["GameModeInput"];
/** What the system admin sets on a game: the game without its generated ID, with its modes and game roles as entered. */
export type GameInput = Omit<Game, "id" | "gameRoles" | "modes"> &
  Pick<
    calendarComponents["schemas"]["ReplaceGameRequest"],
    "gameRoles" | "modes"
  >;
export type ApiErrorCode =
  | authComponents["schemas"]["ErrorBody"]["code"]
  | calendarComponents["schemas"]["ErrorBody"]["code"];

/** Contract rule: a group name is 1–50 characters after trim. Used by the local check and the messages. */
export const GROUP_NAME_MAX_LENGTH = 50;
/** Contract rule: a game name is 1–50 characters after trim. */
export const GAME_NAME_MAX_LENGTH = 50;
/** Contract rule: a mode or activity name is 1–50 characters after trim. */
export const MODE_NAME_MAX_LENGTH = 50;
export const ACTIVITY_NAME_MAX_LENGTH = 50;
/** Contract rule: a game role name is 1–30 characters after trim. */
export const GAME_ROLE_NAME_MAX_LENGTH = 30;
/** Contract rule: a default max is an integer from DEFAULT_MAX_PLAYERS_MIN to this value (a 32-bit signed integer). */
export const DEFAULT_MAX_PLAYERS_LIMIT = 2147483647;
export const DEFAULT_MAX_PLAYERS_MIN = 1;
/** Contract rule: this name is the free-text choice and cannot be a game (ADR 0010). */
export const RESERVED_GAME_NAME = "Other";
/** Contract rule: an invite link allows 1–10 uses (ADR 0007). */
export const INVITE_MAX_USES_LIMIT = 10;
/** The form preselects a single use: a quick invite is for one person. */
export const INVITE_MAX_USES_DEFAULT = 1;

const LOGIN_PATH = "/api/auth/login";
const UNKNOWN_CODE = "internal_error";
const UNREACHABLE_CODE = "service_unavailable";
const HTTP_UNAUTHENTICATED = 401;
/** Status used when no HTTP response arrived at all. */
export const NETWORK_FAILURE_STATUS = 0;

/** The port the UI depends on. Implemented by httpApiClient, replaced by a fake in tests. */
export interface ApiClient {
  getCurrentUser(): Promise<AuthUser>;
  logout(): Promise<void>;
  listGroups(): Promise<GroupSummary[]>;
  createGroup(name: string): Promise<GroupSummary>;
  getGroup(groupId: string): Promise<Group>;
  listInviteLinks(groupId: string): Promise<InviteLink[]>;
  createInviteLink(groupId: string, maxUses: number): Promise<InviteLink>;
  revokeInviteLink(groupId: string, linkId: string): Promise<void>;
  getInvite(token: string): Promise<InviteInfo>;
  joinInvite(token: string): Promise<GroupSummary>;
  listGames(): Promise<Game[]>;
  createGame(input: GameInput): Promise<Game>;
  replaceGame(gameId: string, input: GameInput): Promise<Game>;
  deleteGame(gameId: string): Promise<void>;
  /** The group's games, most used first. The free-text "Other" choice is not in the list. */
  listGroupGames(groupId: string): Promise<Game[]>;
  listUpcomingLobbies(groupId: string): Promise<Lobby[]>;
  getLobby(groupId: string, lobbyId: string): Promise<LobbyDetail>;
  createLobby(groupId: string, input: CreateLobbyInput): Promise<Lobby>;
  deleteLobby(groupId: string, lobbyId: string): Promise<void>;
  /**
   * Joins as a player, or changes the seat of a player. The seat is required when the lobby has game
   * roles. Already a player with the same seat is a success.
   */
  joinLobby(groupId: string, lobbyId: string, seat?: Seat): Promise<void>;
  /**
   * Changes the mode of a lobby. `currentModeId` is the mode the caller saw (`null` for none), so a stale view is
   * refused with `lobby_changed`. The answer has no player names, so callers load the lobby again.
   */
  setLobbyMode(
    groupId: string,
    lobbyId: string,
    modeId: string,
    currentModeId: string | null,
  ): Promise<void>;
  /** Sets the game of a lobby with no game, once. The answer has no player names, so callers load the lobby again. */
  setLobbyGame(groupId: string, lobbyId: string, gameId: string): Promise<void>;
  /** Sets the activity of the lobby's mode. The answer has no player names, so callers load the lobby again. */
  setLobbyActivity(
    groupId: string,
    lobbyId: string,
    activityId: string,
  ): Promise<void>;
  /** Clears the activity and keeps the mode. Idempotent. */
  clearLobbyActivity(groupId: string, lobbyId: string): Promise<void>;
  /** Leaves as a player. Not a player is a success, also after the end time. */
  leaveLobby(groupId: string, lobbyId: string): Promise<void>;
  /** Leaves the group. Refused with `own_upcoming_lobbies_exist` while the caller has upcoming lobbies. */
  leaveGroup(groupId: string): Promise<void>;
  /** Makes a member a group admin. Already an admin is a success. There is no way back in the MVP. */
  makeGroupAdmin(groupId: string, userId: string): Promise<void>;
}

/** A failed call. `code` is the contract's error code, never a message from the server. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string) {
    super(code);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export function apiErrorFrom(status: number, code: unknown): ApiError {
  return new ApiError(status, typeof code === "string" ? code : UNKNOWN_CODE);
}

/** No answer, or a 2xx answer without the body the contract promises. Both mean the service cannot be used. */
export function unreachableError(): ApiError {
  return new ApiError(NETWORK_FAILURE_STATUS, UNREACHABLE_CODE);
}

export function isUnauthenticated(error: unknown): boolean {
  return error instanceof ApiError && error.status === HTTP_UNAUTHENTICATED;
}

export function errorCodeOf(error: unknown): string {
  return error instanceof ApiError ? error.code : UNKNOWN_CODE;
}

/** Full-page navigation target. The server handles Discord; the browser never sees Discord tokens. */
export function loginUrl(returnTo: string): string {
  return `${LOGIN_PATH}?${new URLSearchParams({ returnTo })}`;
}
