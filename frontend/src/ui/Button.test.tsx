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

describe("ButtonLink", () => {
  it("is a link named by its text, marked like a Button, with its light span hidden", () => {
    render(
      <ButtonLink variant="ghost" href="/api/auth/login">
        Log in
      </ButtonLink>,
    );

    const link = screen.getByRole("link", { name: "Log in" });
    expect(link.getAttribute("href")).toBe("/api/auth/login");
    expect(link.dataset).toMatchObject({ slot: "button", variant: "ghost" });
    expect(
      link
        .querySelector('[data-slot="button-light"]')
        ?.getAttribute("aria-hidden"),
    ).toBe("true");
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

// REQ-0028 items 4 and 8, ADR 0023 Amendment 2026-11-18, ADR 0021 A10.
describe("button glow and touch height in global.css", () => {
  // The last ::after rule that names the button outside a :not(), as the cascade sees it.
  const glowRule = (button: string) =>
    cssRules
      .filter(
        ({ selector }) =>
          selector.endsWith("::after") &&
          selector.replace(/:not\([^)]*\)/g, "").includes(button),
      )
      .at(-1)?.body ?? "";
  const variant = (name: string) => `[data-variant="${name}"]`;

  it("gives primary and danger their glow", () => {
    expect(glowRule(variant("primary"))).toMatch(
      /box-shadow: var\(--shadow-button-glow-primary\)/,
    );
    expect(glowRule(variant("danger"))).toMatch(
      /box-shadow: var\(--shadow-button-glow-danger\)/,
    );
  });

  it("gives secondary and ghost no glow", () => {
    for (const name of ["secondary", "ghost"])
      expect(glowRule(variant(name))).toMatch(/content: none/);
  });

  it("has no separate touch button size: coarse pointers use --size-tap", () => {
    expect(stylesheet).not.toMatch(
      /--size-button-touch|--shadow-button-glow-accent/,
    );
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
