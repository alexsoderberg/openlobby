import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useLoad } from "./useLoad";
import { pageLoadsSettled } from "./pageLoads";

afterEach(() => vi.useRealTimers());

function settledFlag(timeoutMs: number) {
  const flag = { done: false };
  void pageLoadsSettled(timeoutMs).then(() => (flag.done = true));
  return flag;
}

describe("page loads", () => {
  it("waits for a first load, which is registered as soon as the page is mounted", async () => {
    let finish!: (value: string) => void;
    const load = () => new Promise<string>((resolve) => (finish = resolve));
    renderHook(() => useLoad(load));
    const flag = settledFlag(60_000);

    await act(async () => {});
    expect(flag.done).toBe(false);
    await act(async () => finish("value"));
    expect(flag.done).toBe(true);
  });

  it("does not wait for a refresh", async () => {
    const load = vi.fn(() => Promise.resolve("value"));
    const { result } = renderHook(() => useLoad(load));
    await act(async () => {});
    let finish!: (value: string) => void;
    load.mockImplementation(() => new Promise((resolve) => (finish = resolve)));
    await act(async () => result.current.refresh());
    const flag = settledFlag(60_000);

    await act(async () => {});
    expect(flag.done).toBe(true);
    finish("new");
  });

  it("counts a failed load as settled", async () => {
    const load = () => Promise.reject(new Error("down"));
    renderHook(() => useLoad(load));
    const flag = settledFlag(60_000);

    await act(async () => {});
    expect(flag.done).toBe(true);
  });

  it("gives up waiting for a load that hangs", async () => {
    vi.useFakeTimers();
    renderHook(() => useLoad(() => new Promise<string>(() => {})));
    const flag = settledFlag(400);

    await act(async () => vi.advanceTimersByTimeAsync(399));
    expect(flag.done).toBe(false);
    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(flag.done).toBe(true);
  });
});
