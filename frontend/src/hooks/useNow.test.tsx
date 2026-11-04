import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useNow } from "./useNow";

describe("useNow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 4, 12, 0));
  });
  afterEach(() => vi.useRealTimers());

  it("moves on with the clock at the given interval", () => {
    const { result } = renderHook(() => useNow(1000));
    const first = result.current;

    act(() => vi.advanceTimersByTime(3000));

    expect(result.current - first).toBe(3000);
  });

  it("stops its timer on unmount", () => {
    const { unmount } = renderHook(() => useNow(1000));
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
