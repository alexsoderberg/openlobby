import type { ReactNode } from "react";

/** A surface for one block of a screen. */
export function Panel({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={className ? `panel ${className}` : "panel"}>
      {children}
    </section>
  );
}
