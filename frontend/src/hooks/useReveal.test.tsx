import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useReveal } from "./useReveal";

class FakeIntersectionObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  callback: IntersectionObserverCallback;
  options?: IntersectionObserverInit;

  constructor(
    callback: IntersectionObserverCallback,
    options?: IntersectionObserverInit,
  ) {
    this.callback = callback;
    this.options = options;
    observers.push(this);
  }
}

let observers: FakeIntersectionObserver[];
let prefersReducedMotion: boolean;

function stubIntersectionObserver() {
  observers = [];
  vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
}

function intersect(
  index: number,
  isIntersecting: boolean,
  geometry: Partial<IntersectionObserverEntry> = {},
) {
  const entry = {
    isIntersecting,
    intersectionRatio: 1,
    boundingClientRect: { height: 100 } as DOMRectReadOnly,
    rootBounds: { height: 800 } as DOMRectReadOnly,
    ...geometry,
  } as IntersectionObserverEntry;
  observers[index].callback([entry], {} as IntersectionObserver);
}

function Probe({ className }: { className?: string }) {
  const revealRef = useReveal<HTMLParagraphElement>();
  return (
    <p ref={revealRef} className={className}>
      Revealed text
    </p>
  );
}

describe("useReveal", () => {
  beforeEach(() => {
    prefersReducedMotion = false;
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: prefersReducedMotion,
        media: query,
      })),
    );
    stubIntersectionObserver();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("marks the element pending and shows it once it intersects", () => {
    render(<Probe />);
    const element = screen.getByText("Revealed text");

    expect(element.getAttribute("data-reveal")).toBe("pending");

    intersect(0, true);

    expect(element.getAttribute("data-reveal")).toBe("shown");
  });

  it("keeps the element shown after React re-renders it with another className", () => {
    const { rerender } = render(<Probe className="first" />);
    intersect(0, true);

    rerender(<Probe className="second" />);

    const element = screen.getByText("Revealed text");
    expect(element.className).toBe("second");
    expect(element.getAttribute("data-reveal")).toBe("shown");
  });

  it("shows the element immediately when reduced motion is preferred", () => {
    prefersReducedMotion = true;
    render(<Probe />);

    expect(screen.getByText("Revealed text").getAttribute("data-reveal")).toBe(
      "shown",
    );
  });

  it("shows the element immediately without IntersectionObserver", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    render(<Probe />);

    expect(screen.getByText("Revealed text").getAttribute("data-reveal")).toBe(
      "shown",
    );
  });

  it("stops observing after the first reveal", () => {
    render(<Probe />);

    intersect(0, true);

    expect(observers[0].unobserve).toHaveBeenCalledWith(
      screen.getByText("Revealed text"),
    );
  });

  it("disconnects the observer when the element unmounts", () => {
    const { unmount } = render(<Probe />);

    unmount();

    expect(observers[0].disconnect).toHaveBeenCalledOnce();
  });

  it("ignores entries that are not intersecting", () => {
    render(<Probe />);

    intersect(0, false);

    expect(screen.getByText("Revealed text").getAttribute("data-reveal")).toBe(
      "pending",
    );
  });

  it("reveals an element too tall to ever be 20% visible", () => {
    render(<Probe />);

    intersect(0, true, {
      intersectionRatio: 0.05,
      boundingClientRect: { height: 5000 } as DOMRectReadOnly,
      rootBounds: { height: 800 } as DOMRectReadOnly,
    });

    expect(screen.getByText("Revealed text").getAttribute("data-reveal")).toBe(
      "shown",
    );
  });

  it("is notified on first contact, so a tall element gets a callback at all", () => {
    render(<Probe />);

    expect(observers[0].options?.threshold).toContain(0);
  });

  it("waits while a normal-sized element is barely visible", () => {
    render(<Probe />);

    intersect(0, true, {
      intersectionRatio: 0.05,
      boundingClientRect: { height: 200 } as DOMRectReadOnly,
      rootBounds: { height: 800 } as DOMRectReadOnly,
    });

    expect(screen.getByText("Revealed text").getAttribute("data-reveal")).toBe(
      "pending",
    );
  });
});
