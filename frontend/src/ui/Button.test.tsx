import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
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
});
