import { initialsOf } from "./initials";

/** A round badge with the initials of a name. Decorative: the name is always written next to it or on the link. */
export function Avatar({ name }: { name: string }) {
  return (
    <span className="initials-icon" aria-hidden="true">
      {initialsOf(name)}
    </span>
  );
}
