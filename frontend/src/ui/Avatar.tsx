import { initialsOf } from "./initials";

/** A square with small corners and the initials of a name (ADR 0028 section 16.8). Decorative: the name is always written next to it or on the link. */
export function Avatar({ name }: { name: string }) {
  return (
    <span className="initials-icon" aria-hidden="true">
      {initialsOf(name)}
    </span>
  );
}
