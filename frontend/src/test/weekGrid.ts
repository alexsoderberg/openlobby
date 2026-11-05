/** The day columns of the week time grid, Monday first, and the ones CSS shows on phones. */
export const dayColumns = () =>
  Array.from(document.querySelectorAll<HTMLElement>("li.time-grid__day"));
export const selectedColumns = () =>
  dayColumns().filter((column) => column.hasAttribute("data-selected"));
