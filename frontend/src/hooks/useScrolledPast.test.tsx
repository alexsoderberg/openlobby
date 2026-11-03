import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useScrolledPast } from "./useScrolledPast";

function scrollTo(y: number) {
  Object.defineProperty(window, "scrollY", { value: y, configurable: true });
  window.dispatchEvent(new Event("scroll"));
}

describe("useScrolledPast", () => {
  afterEach(() => scrollTo(0));

  it("is false at the top of the page", () => {
    const { result } = renderHook(() => useScrolledPast(20));

    expect(result.current).toBe(false);
  });

  it("becomes true once the page is scrolled past the offset, and back at the top", () => {
    const { result } = renderHook(() => useScrolledPast(20));

    act(() => scrollTo(21));
    expect(result.current).toBe(true);

    act(() => scrollTo(0));
    expect(result.current).toBe(false);
  });

  it("removes its scroll listener on unmount", () => {
    const removeListener = vi.spyOn(window, "removeEventListener");
    const { unmount } = renderHook(() => useScrolledPast(20));

    unmount();

    expect(removeListener).toHaveBeenCalledWith("scroll", expect.any(Function));
  });
});
