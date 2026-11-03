import { useCallback, type RefCallback } from "react";

const REVEAL_THRESHOLD = 0.2;
// Threshold 0 as well, otherwise an element taller than 5 viewports never fires a callback.
const OBSERVER_THRESHOLDS = [0, REVEAL_THRESHOLD];
const REVEAL_ATTRIBUTE = "data-reveal";
const PENDING = "pending";
const SHOWN = "shown";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function isRevealable(entry: IntersectionObserverEntry): boolean {
  // A null rootBounds (cross-origin root) counts as 0, so the element reveals at once by design.
  const viewportHeight = entry.rootBounds?.height ?? 0;
  const tooTallForThreshold =
    entry.boundingClientRect.height * REVEAL_THRESHOLD > viewportHeight;
  return (
    entry.isIntersecting &&
    (entry.intersectionRatio >= REVEAL_THRESHOLD || tooTallForThreshold)
  );
}

/**
 * Reveals an element once it is 20% visible, or on first contact if it is too tall for that.
 * The state lives in the `data-reveal` attribute, which React does not rewrite on re-render
 * (a class could be lost when className changes). With reduced motion, or without
 * IntersectionObserver, the element is shown at once, so content is never left hidden.
 */
export function useReveal<T extends Element>(): RefCallback<T> {
  return useCallback((element: T | null) => {
    if (!element) return undefined;

    if (
      window.matchMedia(REDUCED_MOTION_QUERY).matches ||
      typeof IntersectionObserver === "undefined"
    ) {
      element.setAttribute(REVEAL_ATTRIBUTE, SHOWN);
      return undefined;
    }

    element.setAttribute(REVEAL_ATTRIBUTE, PENDING);
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some(isRevealable)) return;
        element.setAttribute(REVEAL_ATTRIBUTE, SHOWN);
        observer.unobserve(element);
      },
      { threshold: OBSERVER_THRESHOLDS },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
}
