import { useLayoutEffect, type RefObject } from "react";

/** The element's distance from the top of the page. offsetTop ignores the transforms of reveal animations. */
function pageTop(element: HTMLElement): number {
  let top = 0;
  let node: Element | null = element;
  while (node instanceof HTMLElement) {
    top += node.offsetTop;
    node = node.offsetParent;
  }
  return top;
}

/**
 * Keeps `--grid-top` on the element at its distance from the top of the page, so CSS can stretch it to the
 * bottom of the window (REQ-0019). JS, because what sits above the grid differs per page and changes (Next up,
 * headings that wrap, fonts): a CSS fill would need every ancestor of the grid to be a flex column, and would
 * share the height with the members panel below it. Set before paint, then again after any change of the
 * page's size.
 */
export function useGridTop(ref: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const place = () =>
      element.style.setProperty("--grid-top", `${pageTop(element)}px`);
    place();
    // Deferred to the next frame: writing inside the observer callback resizes the body and trips the browser's loop guard. The value depends only on content above the grid, so a second write changes nothing.
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(place);
    });
    observer.observe(document.body);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [ref]);
}
