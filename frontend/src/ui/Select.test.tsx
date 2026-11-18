import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { chooseOption } from "../test/chooseOption";
import { Select, type DropdownOption } from "./Select";

const games: DropdownOption[] = [
  { value: "", label: "No game" },
  { value: "g-catan", label: "Catan" },
  { value: "g-chess", label: "Chess" },
  { value: "g-checkers", label: "Checkers" },
];

/** A Select between two buttons, holding its value as a form would. */
function Field({
  initial = "",
  options = games,
  onValueChange = () => undefined,
  ...props
}: Partial<Parameters<typeof Select>[0]> & { initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <form>
      <button type="button">Before</button>
      <label htmlFor="game">Game</label>
      <Select
        id="game"
        value={value}
        options={options}
        onValueChange={(next) => {
          setValue(next);
          onValueChange(next);
        }}
        {...props}
      />
      <button type="button">After</button>
    </form>
  );
}

// While the list is open, Radix hides the rest of the page from screen readers, the field included.
const field = () =>
  screen.getByRole("combobox", { name: "Game", hidden: true });
const focused = () => document.activeElement;
/** Opens the list from the keyboard and waits for Radix to focus its option. */
async function openWith(key: string, init: { altKey?: boolean } = {}) {
  fireEvent.keyDown(field(), { key, ...init });
  await waitFor(() => expect(focused()?.getAttribute("role")).toBe("option"));
}
const press = (key: string, init: { shiftKey?: boolean } = {}) =>
  fireEvent.keyDown(focused()!, { key, ...init });

describe("Select values", () => {
  it.each([
    ["with a click", () => chooseOption(field(), "Catan")],
    [
      "with Enter",
      async () => {
        await openWith("Enter");
        press("Enter");
      },
    ],
  ])(
    "reports a pick of the shown value %s only with reportRepick",
    async (_, pick) => {
      const onValueChange = vi.fn();
      const { unmount } = render(
        <Field initial="g-catan" onValueChange={onValueChange} />,
      );
      await pick();
      expect(onValueChange).not.toHaveBeenCalled();
      unmount();

      render(
        <Field initial="g-catan" onValueChange={onValueChange} reportRepick />,
      );
      await pick();
      expect(onValueChange).toHaveBeenCalledExactlyOnceWith("g-catan");
    },
  );

  it("reports nothing with reportRepick when the list closes without a pick", async () => {
    const onValueChange = vi.fn();
    render(
      <Field initial="g-catan" onValueChange={onValueChange} reportRepick />,
    );
    await openWith("Enter");
    press("Escape");
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("keeps the empty choice as an empty value both ways", async () => {
    const onValueChange = vi.fn();
    render(<Field initial="g-catan" onValueChange={onValueChange} />);

    await chooseOption(field(), "No game");

    expect(onValueChange).toHaveBeenLastCalledWith("");
    expect(field().textContent).toBe("No game");
  });

  it("carries the real value in a hidden input when it has a name", async () => {
    const { container } = render(<Field name="game" />);
    const input = () =>
      container.querySelector<HTMLInputElement>('input[name="game"]');
    expect(input()?.value).toBe("");

    await chooseOption(field(), "Chess");
    expect(input()?.value).toBe("g-chess");
  });

  it("shows the placeholder, which is no option, while nothing is chosen", async () => {
    render(<Field options={games.slice(1)} placeholder="Choose a game" />);
    expect(field().textContent).toBe("Choose a game");

    await openWith("Enter");
    expect(screen.queryByRole("option", { name: "Choose a game" })).toBeNull();
  });

  it("shows a saved value that is no longer offered, and does not offer it", async () => {
    const onValueChange = vi.fn();
    render(
      <Field
        initial="g-gone"
        onValueChange={onValueChange}
        options={[
          { value: "g-gone", label: "Old game", disabled: true },
          ...games,
        ]}
      />,
    );
    expect(field().textContent).toBe("Old game");

    fireEvent.pointerDown(field(), { button: 0, pointerType: "mouse" });
    const old = screen.getByRole("option", { name: "Old game" });
    expect(old.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(old);
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("shows the leading visual in the row and the field, and names the option by its label", async () => {
    render(
      <Field
        initial="g-catan"
        options={[
          {
            value: "g-catan",
            label: "Catan",
            leading: <span aria-hidden="true" data-testid="logo" />,
          },
        ]}
      />,
    );
    expect(screen.getAllByTestId("logo")).toHaveLength(1);

    await openWith("Enter");
    expect(screen.getByRole("option", { name: "Catan" })).toBeTruthy();
    expect(screen.getAllByTestId("logo")).toHaveLength(2);
  });
});

describe("Select keyboard (REQ-0027)", () => {
  it.each([["Enter"], [" "], ["ArrowDown"]])(
    "opens on %j with focus on the chosen option",
    async (key) => {
      render(<Field initial="g-chess" />);
      expect(field().getAttribute("aria-expanded")).toBe("false");

      await openWith(key);

      expect(field().getAttribute("aria-expanded")).toBe("true");
      expect(focused()?.textContent).toBe("Chess");
    },
  );

  it("opens on Alt+Down", async () => {
    render(<Field />);
    await openWith("ArrowDown", { altKey: true });
    expect(focused()?.textContent).toBe("No game");
  });

  it("moves with the arrows, Home and End, stopping at the ends", async () => {
    render(<Field />);
    await openWith("Enter");

    press("ArrowUp");
    await waitFor(() => expect(focused()?.textContent).toBe("No game"));
    press("ArrowDown");
    await waitFor(() => expect(focused()?.textContent).toBe("Catan"));
    press("End");
    await waitFor(() => expect(focused()?.textContent).toBe("Checkers"));
    press("ArrowDown");
    await waitFor(() => expect(focused()?.textContent).toBe("Checkers"));
    press("Home");
    await waitFor(() => expect(focused()?.textContent).toBe("No game"));
  });

  it("chooses with Enter and gives focus back to the field", async () => {
    const onValueChange = vi.fn();
    render(<Field onValueChange={onValueChange} />);
    await openWith("Enter");

    press("ArrowDown");
    await waitFor(() => expect(focused()?.textContent).toBe("Catan"));
    press("Enter");

    expect(onValueChange).toHaveBeenCalledWith("g-catan");
    expect(screen.queryByRole("listbox")).toBeNull();
    await waitFor(() => expect(focused()).toBe(field()));
  });

  it("closes on Escape with no change and focus on the field", async () => {
    const onValueChange = vi.fn();
    render(<Field onValueChange={onValueChange} />);
    await openWith("Enter");

    press("Escape");

    expect(screen.queryByRole("listbox")).toBeNull();
    expect(onValueChange).not.toHaveBeenCalled();
    await waitFor(() => expect(focused()).toBe(field()));
  });

  it.each([
    ["Tab", false, "After"],
    ["Shift+Tab", true, "Before"],
  ])(
    "closes on %s with no change and moves focus on",
    async (_name, shiftKey, next) => {
      const onValueChange = vi.fn();
      render(<Field onValueChange={onValueChange} />);
      await openWith("Enter");

      press("Tab", { shiftKey });

      expect(screen.queryByRole("listbox")).toBeNull();
      await waitFor(() =>
        expect(focused()).toBe(screen.getByRole("button", { name: next })),
      );
      expect(onValueChange).not.toHaveBeenCalled();
    },
  );

  it("jumps to the option a typed letter starts, and on to the next on a repeat", async () => {
    render(<Field />);
    await openWith("Enter");

    press("c");
    await waitFor(() => expect(focused()?.textContent).toBe("Catan"));
    press("c");
    await waitFor(() => expect(focused()?.textContent).toBe("Chess"));
  });

  it("finds an option by several letters typed quickly", async () => {
    render(<Field />);
    await openWith("Enter");

    press("c");
    press("h");
    press("e");
    press("c");
    await waitFor(() => expect(focused()?.textContent).toBe("Checkers"));
  });

  it("cannot be opened when disabled", () => {
    render(<Field disabled initial="g-catan" />);

    fireEvent.keyDown(field(), { key: "Enter" });

    expect(field().textContent).toBe("Catan");
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});

// One touch height for every target: the trigger matches the touch buttons (ADR 0021 A10, REQ-0028 item 8).
describe("Select touch height", () => {
  it("is --size-tap high on a coarse pointer", () => {
    render(<Field />);
    expect(field().className).toContain("pointer-coarse:min-h-(--size-tap)");
  });
});
