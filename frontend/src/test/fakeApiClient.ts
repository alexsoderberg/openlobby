import { vi } from "vitest";
import {
  ApiError,
  type ApiClient,
  type AuthUser,
  type GameInput,
} from "../api";

/** The saved game the server answers with: the fields the tests read, without the entered modes and roles. */
function gameOf({ name, defaultMaxPlayers, genre }: GameInput) {
  return { name, defaultMaxPlayers, genre };
}

export const testUser: AuthUser = {
  userId: "5f0c2e1a-9b7d-4c1e-8a3f-1d2e3f4a5b6c",
  displayName: "Maja Lind",
  isSystemAdmin: false,
};

/** A fake of the port. By default the caller is logged out. */
export function fakeApiClient(overrides: Partial<ApiClient> = {}): ApiClient {
  return {
    getCurrentUser: vi.fn(() =>
      Promise.reject(new ApiError(401, "unauthenticated")),
    ),
    logout: vi.fn(() => Promise.resolve()),
    listGroups: vi.fn(() => Promise.resolve([])),
    createGroup: vi.fn((name: string) => Promise.resolve({ id: "new", name })),
    getGroup: vi.fn(() => Promise.reject(new ApiError(404, "group_not_found"))),
    listInviteLinks: vi.fn(() => Promise.resolve([])),
    createInviteLink: vi.fn((_groupId: string, maxUses: number) =>
      Promise.resolve({
        id: "new",
        token: "new-token",
        createdByUserId: testUser.userId,
        expiresAt: "2026-11-03T20:00:00Z",
        useCount: 0,
        maxUses,
      }),
    ),
    revokeInviteLink: vi.fn(() => Promise.resolve()),
    getInvite: vi.fn(() => Promise.reject(new ApiError(404, "invite_invalid"))),
    joinInvite: vi.fn(() => Promise.resolve({ id: "g1", name: "Friday crew" })),
    listGames: vi.fn(() => Promise.resolve([])),
    createGame: vi.fn((input: GameInput) =>
      Promise.resolve({ id: "new-game", ...gameOf(input) }),
    ),
    replaceGame: vi.fn((gameId: string, input: GameInput) =>
      Promise.resolve({ id: gameId, ...gameOf(input) }),
    ),
    deleteGame: vi.fn(() => Promise.resolve()),
    listGroupGames: vi.fn(() => Promise.resolve([])),
    listUpcomingLobbies: vi.fn(() => Promise.resolve([])),
    getLobby: vi.fn(() => Promise.reject(new ApiError(404, "lobby_not_found"))),
    createLobby: vi.fn(() =>
      Promise.reject(new ApiError(500, "internal_error")),
    ),
    deleteLobby: vi.fn(() => Promise.resolve()),
    joinLobby: vi.fn(() => Promise.resolve()),
    setLobbyMode: vi.fn(() => Promise.resolve()),
    setLobbyActivity: vi.fn(() => Promise.resolve()),
    clearLobbyActivity: vi.fn(() => Promise.resolve()),
    leaveLobby: vi.fn(() => Promise.resolve()),
    leaveGroup: vi.fn(() => Promise.resolve()),
    makeGroupAdmin: vi.fn(() => Promise.resolve()),
    ...overrides,
  };
}
