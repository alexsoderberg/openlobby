import { onTestFinished } from "vitest";

/** The day columns of the week time grid, Monday first, and the ones CSS shows on phones. */
export const dayColumns = () =>
  Array.from(document.querySelectorAll<HTMLElement>("li.time-grid__day"));
export const selectedColumns = () =>
  dayColumns().filter((column) => column.hasAttribute("data-selected"));

/** Applies the phone rule of global.css, which jsdom does not load: only the selected day shows, until the test ends. */
export function onPhone() {
  const style = document.createElement("style");
  style.textContent = ".time-grid__day:not([data-selected]) { display: none; }";
  document.head.append(style);
  onTestFinished(() => style.remove());
}
