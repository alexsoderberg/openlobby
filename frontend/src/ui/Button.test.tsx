import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { cssRules, stylesheet } from "../test/cssTokens";
import { Button, ButtonLink } from "./Button";

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
    expect(classList).toContain("bg-(--color-signal)");
  });

  // ADR 0028 section 16.3: signal only on the primary, a control-line edge on the secondary, no fill on danger.
  it.each([
    [
      "primary",
      "border-(--color-signal) bg-(--color-signal) text-(--color-on-signal)",
    ],
    [
      "secondary",
      "border-(--color-control-line) bg-(--color-surface) text-(--color-text)",
    ],
    ["ghost", "border-transparent bg-transparent text-(--color-text)"],
    ["danger", "border-(--color-danger) bg-transparent text-(--color-danger)"],
  ] as const)("draws the %s variant with %s", (variant, look) => {
    render(<Button variant={variant}>Go</Button>);
    const { classList } = screen.getByRole("button", { name: "Go" });
    for (const name of look.split(" ")) expect(classList).toContain(name);
    expect(classList).toContain("rounded-(--radius)");
  });

  // The primary keeps its fill on hover; the others take the raised fill (section 16.3).
  it("lights every variant but the primary on hover", () => {
    const hover = cssRules.filter(({ selector }) =>
      selector.startsWith('[data-slot="button"]'),
    );
    expect(
      hover.find(({ selector }) => selector.endsWith(":hover::after"))
        ?.selector,
    ).toBe(
      '[data-slot="button"]:not(:disabled, [data-variant="primary"]):hover::after',
    );
    expect(
      hover.find(({ selector }) => selector === '[data-slot="button"]::after')
        ?.body,
    ).toMatch(/background:\s*var\(--color-raised\)/);
  });
});

describe("ButtonLink", () => {
  it("is a link named by its text, marked like a Button", () => {
    render(
      <ButtonLink variant="ghost" href="/api/auth/login">
        Log in
      </ButtonLink>,
    );

    const link = screen.getByRole("link", { name: "Log in" });
    expect(link.getAttribute("href")).toBe("/api/auth/login");
    expect(link.dataset).toMatchObject({ slot: "button", variant: "ghost" });
  });

  // Unlayered link rules would beat the colour utilities, which sit in a layer, so none may match a ButtonLink.
  it("is matched by none of the global link rules", () => {
    render(<ButtonLink href="/">Log in</ButtonLink>);
    const link = screen.getByRole("link", { name: "Log in" });
    const linkRules = cssRules.filter(
      ({ selector }) =>
        /(^|[\s,(])a\b/.test(selector) && !selector.includes("::"),
    );

    expect(linkRules.length).toBeGreaterThan(0);
    for (const { selector } of linkRules)
      expect(link.matches(selector.replace(/:hover/g, ""))).toBe(false);
  });
});

// A tap on a phone fires :hover and leaves it on; hover looks are only for pointers that can hover.
describe("button hover rules in global.css", () => {
  const HOVER_MEDIA = "@media (hover: hover) and (pointer: fine)";
  const hoverRules = cssRules.filter(
    ({ selector }) =>
      selector.includes(":hover") &&
      // A :not() that leaves buttons out (the global link rule) does not make a rule a button rule.
      selector.replace(/:not\([^)]*\)/g, "").includes('[data-slot="button"]'),
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

// ADR 0028 section 2: no glow, no shadow; ADR 0021 A10: one touch height.
describe("button look and touch height in global.css", () => {
  it("has no glow or shadow on any button rule", () => {
    const buttonRules = cssRules.filter(({ selector }) =>
      selector.includes('[data-slot="button"]'),
    );
    expect(buttonRules.length).toBeGreaterThan(0);
    for (const { selector, body } of buttonRules)
      expect(body, selector).not.toMatch(/shadow|gradient|filter/);
  });

  it("has no separate touch button size: coarse pointers use --size-tap", () => {
    expect(stylesheet).not.toMatch(/--size-button-touch|--shadow-button/);
    const coarseHeights = cssRules
      .filter(({ scopes }) => scopes.includes("@media (pointer: coarse)"))
      .flatMap(({ body }) =>
        Array.from(
          body.matchAll(/min-height:\s*([^;]+);/g),
          ([, value]) => value,
        ),
      );
    expect(coarseHeights.length).toBeGreaterThan(0);
    expect(new Set(coarseHeights)).toEqual(new Set(["var(--size-tap)"]));
    render(<Button>Save</Button>);
    expect(screen.getByRole("button", { name: "Save" }).className).toContain(
      "pointer-coarse:min-h-(--size-tap)",
    );
  });
});
