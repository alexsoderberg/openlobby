import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StepCard } from "../features/landing/StepCard";
import { Panel } from "./Panel";

// Logged-in pages change like an app, so a Panel shows at once; only the landing page reveals on scroll.
describe("Panel", () => {
  it("renders its content with no scroll reveal", () => {
    render(
      <Panel>
        <h2>Members</h2>
      </Panel>,
    );

    const panel = screen.getByRole("heading", {
      name: "Members",
    }).parentElement!;
    expect(panel.hasAttribute("data-reveal")).toBe(false);
  });

  it("leaves the reveal on the landing step cards", () => {
    render(
      <StepCard
        number={2}
        title="Create a group"
        text="Invite your friends."
      />,
    );

    const card = screen.getByRole("heading", {
      name: "2. Create a group",
    }).parentElement!;
    expect(card.hasAttribute("data-reveal")).toBe(true);
  });
});
