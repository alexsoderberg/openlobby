const MAX_INITIALS = 2;

/** Up to two capital letters from the first words of a name, for round avatars and group icons. */
export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, MAX_INITIALS)
    .map((word) => Array.from(word)[0].toUpperCase())
    .join("");
}
