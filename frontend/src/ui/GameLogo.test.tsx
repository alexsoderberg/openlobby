import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GameLogo } from "./GameLogo";

const VERSION = "a".repeat(64);
const logoOf = (container: HTMLElement) => container.querySelector("img");

describe("GameLogo", () => {
  it("shows the logo as a decorative image of its version", () => {
    const { container } = render(
      <GameLogo gameId="g1" name="Deep Rock" version={VERSION} />,
    );

    expect(logoOf(container)?.getAttribute("src")).toBe(
      `/api/games/g1/images/logo?v=${VERSION}`,
    );
    expect(logoOf(container)?.getAttribute("alt")).toBe("");
    expect(screen.queryByText("DR")).toBeNull();
  });

  it.each([null, undefined])(
    "shows the monogram without a version (%s)",
    (version) => {
      const { container } = render(
        <GameLogo gameId="g1" name="Deep Rock" version={version} />,
      );

      expect(logoOf(container)).toBeNull();
      expect(screen.getByText("DR").getAttribute("aria-hidden")).toBe("true");
    },
  );

  it("falls back to the monogram when the image fails, and tries a new version again", () => {
    const { container, rerender } = render(
      <GameLogo gameId="g1" name="Deep Rock" version={VERSION} />,
    );
    fireEvent.error(logoOf(container)!);

    expect(logoOf(container)).toBeNull();
    expect(screen.getByText("DR")).toBeTruthy();

    rerender(
      <GameLogo gameId="g1" name="Deep Rock" version={"b".repeat(64)} />,
    );
    expect(logoOf(container)).not.toBeNull();
  });
});
