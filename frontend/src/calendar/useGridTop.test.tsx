import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useGridTop } from "./useGridTop";

let resized: () => void;
const disconnect = vi.fn();

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ["requestAnimationFrame", "cancelAnimationFrame"],
  });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        resized = callback;
      }
      observe() {}
      disconnect = disconnect;
    },
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  disconnect.mockClear();
});

/** An element at `top` px inside a parent at 100 px. */
function placedElement(top: number) {
  const parent = document.createElement("div");
  const element = document.createElement("div");
  parent.append(element);
  Object.defineProperty(parent, "offsetTop", { value: 100 });
  Object.defineProperty(element, "offsetParent", { value: parent });
  let offsetTop = top;
  Object.defineProperty(element, "offsetTop", { get: () => offsetTop });
  return { element, moveTo: (next: number) => (offsetTop = next) };
}

describe("useGridTop", () => {
  it("sets the distance from the top of the page on mount", () => {
    const { element } = placedElement(40);
    renderHook(() => useGridTop({ current: element }));
    expect(element.style.getPropertyValue("--grid-top")).toBe("140px");
  });

  it("measures again on the frame after the page changes size", () => {
    const { element, moveTo } = placedElement(40);
    renderHook(() => useGridTop({ current: element }));

    moveTo(90);
    resized();
    expect(element.style.getPropertyValue("--grid-top")).toBe("140px");
    vi.advanceTimersToNextFrame();
    expect(element.style.getPropertyValue("--grid-top")).toBe("190px");
  });

  it("stops observing on unmount", () => {
    const { element } = placedElement(40);
    const { unmount } = renderHook(() => useGridTop({ current: element }));
    unmount();
    expect(disconnect).toHaveBeenCalled();
  });
});
