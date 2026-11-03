import type { ReactNode } from "react";
import { useReveal } from "../hooks";

/** A surface for one block of a screen. It reveals on scroll; a `.panel-group` staggers its panels. */
export function Panel({ children }: { children: ReactNode }) {
  const revealRef = useReveal<HTMLElement>();
  return (
    <section ref={revealRef} className="panel">
      {children}
    </section>
  );
}
