import { vi } from "vitest";
import { ApiError, type ApiClient, type AuthUser } from "../api";

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
    ...overrides,
  };
}
