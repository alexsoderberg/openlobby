import type { ReactNode } from "react";

/** Announced to screen readers when shown. Text, not color, carries the meaning. */
export function Alert({ children }: { children: ReactNode }) {
  return (
    <div className="alert" role="alert">
      {children}
    </div>
  );
}
