import { useCallback, useEffect, useRef, useState } from "react";

type Origin = { x: number; y: number };

const ESCAPE = "Escape";

/**
 * Open state of the Create group form and where it grows from: the centre of the pressed "+", measured against
 * the form's own box (not transformed, so the measure is stable). `opening` counts openings, so the form
 * can start empty each time. Closing, by any route, returns focus to the "+" that opened it.
 */
export function useCreateGroupPopover() {
  const [open, setOpen] = useState(false);
  const [opening, setOpening] = useState(0);
  const [origin, setOrigin] = useState<Origin>({ x: 0, y: 0 });
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  const press = useCallback(
    (button: HTMLElement) => {
      if (open) return close();
      const box = popoverRef.current?.getBoundingClientRect();
      const target = button.getBoundingClientRect();
      triggerRef.current = button;
      setOrigin({
        x: target.left + target.width / 2 - (box?.left ?? 0),
        y: target.top + target.height / 2 - (box?.top ?? 0),
      });
      setOpening((count) => count + 1);
      setOpen(true);
    },
    [open, close],
  );

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === ESCAPE) close();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, close]);

  return { open, opening, origin, popoverRef, press, close };
}
