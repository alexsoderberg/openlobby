import { useEffect, useState, type ReactNode } from "react";

const ESCAPE = "Escape";

/**
 * Shows `label` above its child on hover and on keyboard focus (WCAG 1.4.13): the bubble sits inside the
 * wrapper, so the pointer can move onto it, and Escape dismisses it from anywhere. The bubble is aria-hidden
 * because the child already carries the label as its name. Touch screens get no bubble (see global.css).
 */
export function Tooltip({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === ESCAPE) setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <span
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
        <span className="tooltip__bubble" aria-hidden="true">
          {label}
        </span>
      )}
    </span>
  );
}
