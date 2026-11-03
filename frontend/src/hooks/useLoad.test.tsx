import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../api";
import { useLoad } from "./useLoad";

describe("useLoad", () => {
  it("keeps the loaded value", async () => {
    const load = vi.fn(() => Promise.resolve("value"));
    const { result } = renderHook(() => useLoad(load));

    await waitFor(() =>
      expect(result.current.state).toEqual({
        status: "loaded",
        value: "value",
      }),
    );
  });

  it("keeps the error of a failed load", async () => {
    const error = new ApiError(503, "service_unavailable");
    const { result } = renderHook(() => useLoad(() => Promise.reject(error)));

    await waitFor(() =>
      expect(result.current.state).toEqual({ status: "failed", error }),
    );
  });

  it("runs the load again on reload", async () => {
    const load = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new ApiError(503, "service_unavailable"))
      .mockResolvedValueOnce("value");
    const { result } = renderHook(() => useLoad(load));
    await waitFor(() => expect(result.current.state.status).toBe("failed"));

    act(() => result.current.reload());

    await waitFor(() =>
      expect(result.current.state).toEqual({
        status: "loaded",
        value: "value",
      }),
    );
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("hands an expired session to onUnauthenticated and stays loading", async () => {
    const onUnauthenticated = vi.fn();
    const load = () => Promise.reject(new ApiError(401, "unauthenticated"));
    const { result } = renderHook(() => useLoad(load, onUnauthenticated));

    await waitFor(() => expect(onUnauthenticated).toHaveBeenCalledOnce());
    expect(result.current.state).toEqual({ status: "loading" });
  });

  it("keeps an expired session as a failure when no handler is given", async () => {
    const error = new ApiError(401, "unauthenticated");
    const { result } = renderHook(() => useLoad(() => Promise.reject(error)));

    await waitFor(() =>
      expect(result.current.state).toEqual({ status: "failed", error }),
    );
  });
});
