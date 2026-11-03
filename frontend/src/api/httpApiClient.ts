import createClient from "openapi-fetch";
import type { paths as authPaths } from "./gen/auth";
import type { paths as calendarPaths } from "./gen/calendar";
import { apiErrorFrom, unreachableError, type ApiClient } from "./client";

type Paths = authPaths & calendarPaths;
type Settled<T> = { data?: T; error?: unknown; response: Response };

/** Adapter: the only place that knows openapi-fetch. Errors leave it as ApiError. */
export function createHttpApiClient(
  fetchImpl: typeof fetch = fetch,
  baseUrl = "",
): ApiClient {
  const http = createClient<Paths>({ baseUrl, fetch: fetchImpl });

  return {
    getCurrentUser: async () => bodyOf(await receive(http.GET("/api/auth/me"))),
    logout: async () => {
      await receive(http.POST("/api/auth/logout"));
    },
    listGroups: async () => bodyOf(await receive(http.GET("/api/groups"))),
    createGroup: async (name) =>
      bodyOf(await receive(http.POST("/api/groups", { body: { name } }))),
    getGroup: async (groupId) =>
      bodyOf(
        await receive(
          http.GET("/api/groups/{groupId}", {
            params: { path: { groupId } },
          }),
        ),
      ),
    listInviteLinks: async (groupId) =>
      bodyOf(
        await receive(
          http.GET("/api/groups/{groupId}/invite-links", {
            params: { path: { groupId } },
          }),
        ),
      ),
    createInviteLink: async (groupId, maxUses) =>
      bodyOf(
        await receive(
          http.POST("/api/groups/{groupId}/invite-links", {
            params: { path: { groupId } },
            body: { maxUses },
          }),
        ),
      ),
    revokeInviteLink: async (groupId, linkId) => {
      await receive(
        http.DELETE("/api/groups/{groupId}/invite-links/{linkId}", {
          params: { path: { groupId, linkId } },
        }),
      );
    },
    getInvite: async (token) =>
      bodyOf(
        await receive(
          http.GET("/api/invites/{token}", { params: { path: { token } } }),
        ),
      ),
    joinInvite: async (token) =>
      bodyOf(
        await receive(
          http.POST("/api/invites/{token}/join", {
            params: { path: { token } },
          }),
        ),
      ),
  };
}

async function receive<T>(call: Promise<Settled<T>>): Promise<Settled<T>> {
  let result: Settled<T>;
  try {
    result = await call;
  } catch {
    throw unreachableError();
  }
  if (!result.response.ok) {
    throw apiErrorFrom(result.response.status, codeOf(result.error));
  }
  return result;
}

/** A 2xx answer without the promised body is treated as an unreachable service, not as a server error. */
function bodyOf<T>({ data }: Settled<T>): T {
  if (data === undefined) throw unreachableError();
  return data;
}

function codeOf(body: unknown): unknown {
  if (typeof body !== "object" || body === null || !("error" in body))
    return undefined;
  const { error } = body;
  return typeof error === "object" && error !== null && "code" in error
    ? error.code
    : undefined;
}
