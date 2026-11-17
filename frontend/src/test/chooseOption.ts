import { act, fireEvent, within } from "@testing-library/react";

/** The open list. Role queries over the whole page are slow in jsdom, so the options are looked up inside it. */
const openList = () =>
  within(document.querySelector<HTMLElement>('[role="listbox"]')!);
/** Radix gives focus back to the field in a timeout; this waits for it, as a person would. */
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve)));

/** Opens a dropdown list the way a mouse does in Radix Select and clicks the option with this name (ADR 0027). */
export async function chooseOption(combobox: HTMLElement, name: string) {
  fireEvent.pointerDown(combobox, { button: 0, pointerType: "mouse" });
  fireEvent.click(openList().getByRole("option", { name }));
  await settle();
}

/** The option names of a dropdown list: opened with Enter, read, closed with Escape. */
export async function optionNames(combobox: HTMLElement) {
  fireEvent.keyDown(combobox, { key: "Enter" });
  const options = openList().getAllByRole("option");
  fireEvent.keyDown(options[0], { key: "Escape" });
  await settle();
  return options.map((option) => option.textContent);
}
