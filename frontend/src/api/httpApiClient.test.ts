import { describe, expect, it, vi } from "vitest";
import { ApiError } from "./client";
import { createHttpApiClient } from "./httpApiClient";

const BASE_URL = "http://gateway.test";
const errorBody = (code: string) => ({ error: { code, requestId: "r1" } });

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

  it("maps a 503 logout to an ApiError with the contract code", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json(errorBody("service_unavailable"), { status: 503 }),
    );

    const failure = await createHttpApiClient(fetchImpl, BASE_URL)
      .logout()
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ApiError);
    expect(failure).toMatchObject({
      status: 503,
      code: "service_unavailable",
    });
  });

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
    const fetchImpl = vi.fn(async (): Promise<Response> => {
      throw new TypeError("Failed to fetch");
    });

    const failure = await createHttpApiClient(fetchImpl, BASE_URL)
      .listGroups()
      .catch((error: unknown) => error);

    expect(failure).toMatchObject({ status: 0, code: "service_unavailable" });
  });
});
