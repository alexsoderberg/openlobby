import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { Select } from "../ui";
import { usePopover } from "./usePopover";

/** A popover form whose first control is a dropdown list, as the invite popover's max uses. */
function PopoverForm() {
  const { open, popoverRef, press } = usePopover();
  const [value, setValue] = useState("");
  return (
    <>
      <button type="button" onClick={(event) => press(event.currentTarget)}>
        Open
      </button>
      <button type="button">Behind</button>
      {open && (
        <div ref={popoverRef} role="dialog" aria-label="Form">
          <label htmlFor="uses">Uses</label>
          <Select
            id="uses"
            value={value}
            onValueChange={setValue}
            options={[
              { value: "", label: "One" },
              { value: "2", label: "Two" },
            ]}
          />
          <button type="button">Save</button>
        </div>
      )}
    </>
  );
}

// While the list is open, Radix hides the rest of the page from screen readers, the field included.
const field = () =>
  screen.getByRole("combobox", { name: "Uses", hidden: true });

async function openList() {
  render(<PopoverForm />);
  fireEvent.click(screen.getByRole("button", { name: "Open" }));
  fireEvent.keyDown(field(), { key: "Enter" });
  await waitFor(() =>
    expect(document.activeElement?.getAttribute("role")).toBe("option"),
  );
}

describe("a dropdown list in a popover form", () => {
  it("closes only the list on Escape, and the form keeps focus on the field", async () => {
    await openList();

    fireEvent.keyDown(document.activeElement!, { key: "Escape" });

    expect(screen.queryByRole("listbox")).toBeNull();
    expect(screen.getByRole("dialog", { name: "Form" })).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(field()));
  });

  it.each([
    ["Shift+Tab from the first control", true, "Save"],
    ["Tab to the next control", false, "Save"],
  ])("keeps focus inside the form on %s", async (_name, shiftKey, next) => {
    await openList();

    fireEvent.keyDown(document.activeElement!, { key: "Tab", shiftKey });

    expect(screen.getByRole("dialog", { name: "Form" })).toBeTruthy();
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: next }),
      ),
    );
  });
});
