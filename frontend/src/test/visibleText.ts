/** The text a sighted user sees: textContent without the screen-reader-only parts. */
export function visibleText(element: Element): string {
  const copy = element.cloneNode(true) as Element;
  copy
    .querySelectorAll(".visually-hidden")
    .forEach((hidden) => hidden.remove());
  return copy.textContent ?? "";
}
