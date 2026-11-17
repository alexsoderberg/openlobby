import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GameRoleName } from "./GameRoleName";

describe("GameRoleName", () => {
  it("puts the role icon before the name, hidden from screen readers and at the text size", () => {
    const { container } = render(
      <GameRoleName icon="shield">Tank 0/1</GameRoleName>,
    );

    const icon = container.querySelector('[data-icon="shield"]')!;
    expect(icon.getAttribute("aria-hidden")).toBe("true");
    // 1em: the icon follows the font size of the text beside it, so it is never smaller on a phone.
    expect(icon.getAttribute("width")).toBe("1em");
    expect(container.firstElementChild?.firstChild).toBe(icon);
    expect(container.textContent).toBe("Tank 0/1");
  });

  it.each<"none" | null | undefined>([null, "none", undefined])(
    "shows the name only for %s",
    (icon) => {
      const { container } = render(
        <GameRoleName icon={icon}>Tank</GameRoleName>,
      );
      expect(container.querySelector("svg")).toBeNull();
      expect(container.textContent).toBe("Tank");
    },
  );
});
