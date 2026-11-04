import type { CSSProperties, ReactNode, RefObject } from "react";

/**
 * The frame the popover grows out of. The outer box never moves, so the button can be measured against
 * it; only the card inside scales, from the button centre, with transform and opacity alone. The scrim closes
 * the form on a tap outside. Closed, the frame is hidden from sight and from the keyboard (see global.css).
 */
export function Popover({
  label,
  centered = false,
  closeOnScrim = true,
  open,
  origin,
  frameRef,
  onClose,
  children,
}: {
  label: string;
  /** Centred in the window instead of next to the Group rail or the floating "+". */
  centered?: boolean;
  /** False keeps the form open on a tap outside, so typed input is not lost. Esc and Cancel still close it. */
  closeOnScrim?: boolean;
  open: boolean;
  origin: { x: number; y: number };
  frameRef: RefObject<HTMLDivElement | null>;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <>
      <div
        className="scrim"
        data-open={open}
        aria-hidden="true"
        onClick={closeOnScrim ? onClose : undefined}
      />
      <div
        ref={frameRef}
        className={
          centered
            ? "create-popover create-popover--centered"
            : "create-popover"
        }
        data-open={open}
        role="dialog"
        aria-label={label}
        aria-hidden={open ? undefined : true}
        style={
          {
            "--origin-x": `${origin.x}px`,
            "--origin-y": `${origin.y}px`,
          } as CSSProperties
        }
      >
        <div className="create-popover__card">{children}</div>
      </div>
    </>
  );
}
