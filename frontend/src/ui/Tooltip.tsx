import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

const ESCAPE = "Escape";
/** The bubble keeps this far (px) from the window edges. */
const VIEWPORT_MARGIN = 8;

/** Above the trigger and centred on it, moved inwards at a window edge, and below it when there is no room above. */
function placeBubble(bubble: HTMLElement, trigger: DOMRect) {
  const { width, height } = bubble.getBoundingClientRect();
  const centre = Math.min(
    Math.max(trigger.left + trigger.width / 2, width / 2 + VIEWPORT_MARGIN),
    window.innerWidth - width / 2 - VIEWPORT_MARGIN,
  );
  const below = trigger.top < height + VIEWPORT_MARGIN;
  bubble.style.left = `${centre - width / 2}px`;
  bubble.style.top = `${below ? trigger.bottom : trigger.top - height}px`;
  bubble.dataset.side = below ? "below" : "above";
}

/**
 * Shows `label` beside its child on hover and on keyboard focus (WCAG 1.4.13). The bubble is a popover in the
 * top layer, so no overflow or transform around the trigger clips it, yet it stays a DOM child of the wrapper,
 * so the pointer can move onto it. Escape dismisses it from anywhere and a scroll or resize closes it, since
 * it does not follow the trigger. The bubble is aria-hidden because the child already carries the label as its
 * name. Touch screens get no bubble (see global.css).
 */
export function Tooltip({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const bubbleRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const bubble = bubbleRef.current;
    if (!open || !bubble || !wrapperRef.current) return;
    // Without the Popover API the attribute is ignored and the bubble stays a fixed element placed below.
    bubble.showPopover?.();
    placeBubble(bubble, wrapperRef.current.getBoundingClientRect());
    const close = () => setOpen(false);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === ESCAPE) close();
    };
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  return (
    <span
      ref={wrapperRef}
      className="tooltip"
      onPointerEnter={() => setOpen(true)}
      onPointerLeave={() => setOpen(false)}
      // A mouse click also focuses the button; only keyboard focus (focus-visible) opens the bubble.
      onFocus={(event) => {
        if (event.target.matches(":focus-visible")) setOpen(true);
      }}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open && (
        <span
          ref={bubbleRef}
          className="tooltip__bubble"
          popover="manual"
          aria-hidden="true"
        >
          {label}
        </span>
      )}
    </span>
  );
}
