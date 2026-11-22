const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
/** The number of `--color-group-N` tokens in global.css. */
const GROUP_COLOR_COUNT = 6;

/**
 * The group colour, 1 to 6: 32-bit FNV-1a over the UTF-8 bytes of the group ID, mod 6 (ADR 0028 section 5).
 * Derived, so it is the same on every screen and device, and never stored.
 */
export function groupColorIndex(groupId: string): number {
  let hash = FNV_OFFSET_BASIS;
  for (const byte of new TextEncoder().encode(groupId)) {
    hash = Math.imul(hash ^ byte, FNV_PRIME) >>> 0;
  }
  return (hash % GROUP_COLOR_COUNT) + 1;
}
