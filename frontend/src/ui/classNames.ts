/** Joins the class lists that are set: the one class helper of ADR 0023 point 5, instead of clsx and tailwind-merge. */
export function classNames(...lists: (string | undefined)[]): string {
  return lists.filter(Boolean).join(" ");
}
