import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Icon, type IconName } from "./Icon";
import { IconButton } from "./IconButton";

describe("IconButton", () => {
  it("is a button named by its label, and the tooltip shows the same label", () => {
    const onClick = vi.fn();
    render(<IconButton icon="edit" label="Edit" onClick={onClick} />);

    const button = screen.getByRole("button", { name: "Edit" });
    expect(button.querySelector("svg")).not.toBeNull();
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();

    fireEvent.pointerEnter(button);
    const bubble = button.parentElement!.querySelector(
      '[aria-hidden="true"]:not(svg)',
    );
    expect(bubble?.textContent).toBe(button.getAttribute("aria-label"));
  });

  it("adds the subject to the accessible name after the label, and keeps the tooltip short", () => {
    render(<IconButton icon="edit" label="Edit" subject="Chess" />);

    const button = screen.getByRole("button", { name: "Edit, Chess" });
    fireEvent.pointerEnter(button);
    expect(
      button.parentElement!.querySelector('[aria-hidden="true"]:not(svg)')
        ?.textContent,
    ).toBe("Edit");
  });

  it("passes disabled to the button", () => {
    render(<IconButton icon="copy" label="Copy" disabled />);
    expect(
      (screen.getByRole("button", { name: "Copy" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });
});

// A Record over IconName fails to compile when a name is added without being listed here.
const everyIcon: Record<IconName, true> = {
  back: true,
  calendar: true,
  chevronDown: true,
  chevronRight: true,
  close: true,
  copy: true,
  edit: true,
  forward: true,
  gameList: true,
  groups: true,
  home: true,
  invite: true,
  join: true,
  leave: true,
  list: true,
  logIn: true,
  logOut: true,
  makeAdmin: true,
  plus: true,
  remove: true,
  retry: true,
  revoke: true,
  save: true,
  you: true,
};

describe("Icon", () => {
  it.each(Object.keys(everyIcon) as IconName[])(
    "renders %s as a hidden, unfocusable SVG",
    (name) => {
      const { container } = render(<Icon name={name} />);
      const svg = container.querySelector("svg");
      expect(svg?.getAttribute("aria-hidden")).toBe("true");
      expect(svg?.getAttribute("focusable")).toBe("false");
    },
  );
});
