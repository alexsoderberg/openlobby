import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { cssRules } from "../test/cssTokens";
import { Button } from "./Button";

describe("Button", () => {
  it("is a button named by its text that runs its click handler", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);

    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  // global.css styles the type, shadow and motion of each variant by these attributes.
  it("marks its slot, variant and size, primary and default when none is given", () => {
    render(
      <>
        <Button>Join</Button>
        <Button variant="danger" type="submit">
          Remove
        </Button>
      </>,
    );

    const join = screen.getByRole("button", { name: "Join" });
    expect(join.dataset).toMatchObject({
      slot: "button",
      variant: "primary",
      size: "default",
    });
    const remove = screen.getByRole("button", { name: "Remove" });
    expect(remove.dataset.variant).toBe("danger");
    expect(remove.getAttribute("type")).toBe("submit");
  });

  // A feature places a Button with its own class (ADR 0023 point 2, cascade b); the variant classes stay.
  it("keeps a passed className beside its own classes", () => {
    render(<Button className="group-form__submit">Save</Button>);
    const { classList } = screen.getByRole("button", { name: "Save" });
    expect(classList).toContain("group-form__submit");
    expect(classList).toContain("bg-(--color-accent)");
  });

  // The light span is decoration: hidden from assistive tech and without text, so the name stays the label.
  it("renders its light span hidden from assistive tech and without text", () => {
    render(<Button>Save</Button>);
    const light = screen
      .getByRole("button", { name: "Save" })
      .querySelector('[data-slot="button-light"]');

    expect(light?.getAttribute("aria-hidden")).toBe("true");
    expect(light?.textContent).toBe("");
  });

  // The follow light reads the pointer from two CSS variables; a caller's own handler must still run.
  it("puts the pointer position in --pointer-x and --pointer-y and calls the caller's onPointerMove", () => {
    const onPointerMove = vi.fn();
    render(<Button onPointerMove={onPointerMove}>Save</Button>);
    const button = screen.getByRole("button", { name: "Save" });
    vi.spyOn(button, "getBoundingClientRect").mockReturnValue(
      new DOMRect(10, 20, 100, 32),
    );

    fireEvent.pointerMove(button, { clientX: 40, clientY: 30 });

    expect(button.style.getPropertyValue("--pointer-x")).toBe("30px");
    expect(button.style.getPropertyValue("--pointer-y")).toBe("10px");
    expect(onPointerMove).toHaveBeenCalledOnce();
  });
});

// A tap on a phone fires :hover and leaves it on; hover looks are only for pointers that can hover.
describe("button hover rules in global.css", () => {
  const HOVER_MEDIA = "@media (hover: hover) and (pointer: fine)";
  const hoverRules = cssRules.filter(
    ({ selector }) =>
      selector.includes(":hover") &&
      /\[data-slot="button"\]|\.button\b/.test(selector),
  );

  it("finds them", () => {
    expect(hoverRules.length).toBeGreaterThan(0);
  });

  it("puts every one inside the hover media query", () => {
    expect(
      hoverRules.filter(({ scopes }) => !scopes.includes(HOVER_MEDIA)),
    ).toEqual([]);
  });
});
