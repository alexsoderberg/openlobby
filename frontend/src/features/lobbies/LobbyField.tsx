import type { ReactNode } from "react";

/** What a control needs to be tied to its hint and, when the form's error is about it, to that error. */
export function fieldProps(id: string, hasHint: boolean, errorId?: string) {
  const describedBy = [hasHint ? `${id}-hint` : undefined, errorId]
    .filter(Boolean)
    .join(" ");
  return {
    id,
    "aria-invalid": errorId !== undefined || undefined,
    "aria-describedby": describedBy || undefined,
  };
}

/** A label, its control and an optional hint. The control gets its attributes from fieldProps. */
export function LobbyField({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <>
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && (
        <p id={`${id}-hint`} className="form-hint">
          {hint}
        </p>
      )}
    </>
  );
}
