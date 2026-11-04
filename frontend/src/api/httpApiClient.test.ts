import { describe, expect, it, vi } from "vitest";
import { ApiError, type ApiClient } from "./client";
import { createHttpApiClient } from "./httpApiClient";

const BASE_URL = "http://gateway.test";
const errorBody = (code: string) => ({ error: { code, requestId: "r1" } });
const networkFailure = async (): Promise<Response> => {
  throw new TypeError("Failed to fetch");
};

const failingCalls: Array<[string, (api: ApiClient) => Promise<unknown>]> = [
  ["createGroup", (api) => api.createGroup("Friday crew")],
  ["getGroup", (api) => api.getGroup("g1")],
  ["listInviteLinks", (api) => api.listInviteLinks("g1")],
  ["createInviteLink", (api) => api.createInviteLink("g1", 10)],
  ["revokeInviteLink", (api) => api.revokeInviteLink("g1", "l1")],
  ["getInvite", (api) => api.getInvite("t1")],
  ["joinInvite", (api) => api.joinInvite("t1")],
  ["listGames", (api) => api.listGames()],
  [
    "createGame",
    (api) => api.createGame({ name: "Catan", defaultMaxPlayers: 4 }),
  ],
  [
    "replaceGame",
    (api) => api.replaceGame("g1", { name: "Catan", defaultMaxPlayers: null }),
  ],
  ["deleteGame", (api) => api.deleteGame("g1")],
  ["listGroupGames", (api) => api.listGroupGames("g1")],
  ["listUpcomingLobbies", (api) => api.listUpcomingLobbies("g1")],
  ["getLobby", (api) => api.getLobby("g1", "l1")],
  [
    "createLobby",
    (api) =>
      api.createLobby("g1", {
        startsAt: "2026-11-05T18:00:00Z",
        endsAt: "2026-11-05T20:00:00Z",
        customGameName: "Chess",
      }),
  ],
  ["deleteLobby", (api) => api.deleteLobby("g1", "l1")],
];

describe("createHttpApiClient", () => {
  it("returns the logged-in user from the body", async () => {
    const user = { userId: "u1", displayName: "Maja", isSystemAdmin: false };
    const fetchImpl = vi.fn(async () => Response.json(user));

    await expect(
      createHttpApiClient(fetchImpl, BASE_URL).getCurrentUser(),
    ).resolves.toEqual(user);
  });

  it("returns the group list from the body", async () => {
    const groups = [{ id: "g1", name: "Friday crew" }];
    const fetchImpl = vi.fn(async () => Response.json(groups));

    await expect(
      createHttpApiClient(fetchImpl, BASE_URL).listGroups(),
    ).resolves.toEqual(groups);
  });

  it("posts the logout and resolves on 204", async () => {
    const sent: Request[] = [];
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      sent.push(new Request(input));
      return new Response(null, { status: 204 });
    });

    await expect(
      createHttpApiClient(fetchImpl, BASE_URL).logout(),
    ).resolves.toBeUndefined();
    expect(sent[0]).toMatchObject({ method: "POST" });
  });

  it("posts the name to create a group and returns the created group", async () => {
    const created = { id: "g1", name: "Friday crew" };
    const sent: Request[] = [];
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      sent.push(new Request(input));
      return Response.json(created, { status: 201 });
    });

    await expect(
      createHttpApiClient(fetchImpl, BASE_URL).createGroup("Friday crew"),
    ).resolves.toEqual(created);
    expect(sent[0]).toMatchObject({ method: "POST" });
    expect(new URL(sent[0].url).pathname).toBe("/api/groups");
    await expect(sent[0].json()).resolves.toEqual({ name: "Friday crew" });
  });

  it("maps a 400 from createGroup to invalid_group_name", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json(errorBody("invalid_group_name"), { status: 400 }),
    );

    const failure = await createHttpApiClient(fetchImpl, BASE_URL)
      .createGroup("")
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ApiError);
    expect(failure).toMatchObject({
      status: 400,
      code: "invalid_group_name",
    });
  });

  it("returns the group with its members from the body", async () => {
    const group = {
      id: "g1",
      name: "Friday crew",
      members: [{ userId: "u1", displayName: "Maja", role: "admin" }],
    };
    const sent: Request[] = [];
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      sent.push(new Request(input));
      return Response.json(group);
    });

    await expect(
      createHttpApiClient(fetchImpl, BASE_URL).getGroup("g1"),
    ).resolves.toEqual(group);
    expect(new URL(sent[0].url).pathname).toBe("/api/groups/g1");
  });

  it("posts the chosen max uses and returns the created link", async () => {
    const link = {
      id: "l1",
      token: "t1",
      createdByUserId: "u1",
      expiresAt: "2026-11-03T20:00:00Z",
      useCount: 0,
      maxUses: 3,
    };
    const sent: Request[] = [];
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      sent.push(new Request(input));
      return Response.json(link, { status: 201 });
    });

    await expect(
      createHttpApiClient(fetchImpl, BASE_URL).createInviteLink("g1", 3),
    ).resolves.toEqual(link);
    expect(sent[0]).toMatchObject({ method: "POST" });
    expect(new URL(sent[0].url).pathname).toBe("/api/groups/g1/invite-links");
    await expect(sent[0].json()).resolves.toEqual({ maxUses: 3 });
  });

  it("puts the whole game to its own address and deletes it", async () => {
    const sent: Request[] = [];
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      sent.push(new Request(input));
      return sent.length === 1
        ? Response.json({ id: "g1", name: "Catan", defaultMaxPlayers: null })
        : new Response(null, { status: 204 });
    });
    const api = createHttpApiClient(fetchImpl, BASE_URL);

    await api.replaceGame("g1", { name: "Catan", defaultMaxPlayers: null });
    await api.deleteGame("g1");

    expect(sent.map((request) => request.method)).toEqual(["PUT", "DELETE"]);
    expect(new URL(sent[0].url).pathname).toBe("/api/games/g1");
    await expect(sent[0].json()).resolves.toEqual({
      name: "Catan",
      defaultMaxPlayers: null,
    });
  });

  it("deletes the link and resolves on 204", async () => {
    const sent: Request[] = [];
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      sent.push(new Request(input));
      return new Response(null, { status: 204 });
    });

    await expect(
      createHttpApiClient(fetchImpl, BASE_URL).revokeInviteLink("g1", "l1"),
    ).resolves.toBeUndefined();
    expect(sent[0]).toMatchObject({ method: "DELETE" });
    expect(new URL(sent[0].url).pathname).toBe(
      "/api/groups/g1/invite-links/l1",
    );
  });

  it("maps a 404 from getInvite to invite_invalid without group data", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json(errorBody("invite_invalid"), { status: 404 }),
    );

    const failure = await createHttpApiClient(fetchImpl, BASE_URL)
      .getInvite("t1")
      .catch((error: unknown) => error);

    expect(failure).toMatchObject({ status: 404, code: "invite_invalid" });
  });

  it("maps a 404 from getGroup to group_not_found", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json(errorBody("group_not_found"), { status: 404 }),
    );

    const failure = await createHttpApiClient(fetchImpl, BASE_URL)
      .getGroup("g1")
      .catch((error: unknown) => error);

    expect(failure).toMatchObject({ status: 404, code: "group_not_found" });
  });

  it.each(failingCalls)(
    "maps a 503 from %s to service_unavailable",
    async (_name, call) => {
      const fetchImpl = vi.fn(async () =>
        Response.json(errorBody("service_unavailable"), { status: 503 }),
      );

      const failure = await call(
        createHttpApiClient(fetchImpl, BASE_URL),
      ).catch((error: unknown) => error);

      expect(failure).toMatchObject({
        status: 503,
        code: "service_unavailable",
      });
    },
  );

  it.each(failingCalls)(
    "maps a network failure from %s to service_unavailable",
    async (_name, call) => {
      const fetchImpl = vi.fn(networkFailure);

      const failure = await call(
        createHttpApiClient(fetchImpl, BASE_URL),
      ).catch((error: unknown) => error);

      expect(failure).toMatchObject({ status: 0, code: "service_unavailable" });
    },
  );

  it("maps a 401 error body to an ApiError with the contract code", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json(errorBody("unauthenticated"), { status: 401 }),
    );

    const failure = await createHttpApiClient(fetchImpl, BASE_URL)
      .getCurrentUser()
      .catch((error: unknown) => error);

    expect(failure).toMatchObject({ status: 401, code: "unauthenticated" });
  });

  it("maps an error without a JSON code to internal_error", async () => {
    const fetchImpl = vi.fn(
      async () => new Response("<html>oops</html>", { status: 500 }),
    );

    const failure = await createHttpApiClient(fetchImpl, BASE_URL)
      .listGroups()
      .catch((error: unknown) => error);

    expect(failure).toMatchObject({ status: 500, code: "internal_error" });
  });

  it("treats a 200 answer without a body as an unreachable service", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 200 }));

    const failure = await createHttpApiClient(fetchImpl, BASE_URL)
      .getCurrentUser()
      .catch((error: unknown) => error);

    expect(failure).toMatchObject({ status: 0, code: "service_unavailable" });
  });

  it("maps a network failure to service_unavailable", async () => {
    const fetchImpl = vi.fn(networkFailure);

    const failure = await createHttpApiClient(fetchImpl, BASE_URL)
      .listGroups()
      .catch((error: unknown) => error);

    expect(failure).toMatchObject({ status: 0, code: "service_unavailable" });
  });
});
