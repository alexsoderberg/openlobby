import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { en } from "../../i18n/messages/en";
import { LandingPage } from "./LandingPage";

const LOGIN_HREF = "/api/auth/login?returnTo=%2F";
const HEADLINE = en.landing.headlineLines.join(" ");

function renderLanding(props: Partial<Parameters<typeof LandingPage>[0]> = {}) {
  return render(<LandingPage returnTo="/" reason="start" {...props} />);
}

describe("LandingPage", () => {
  it("shows the headline and Discord login links to the existing login URL", () => {
    renderLanding();

    expect(
      screen.getByRole("heading", { level: 1, name: HEADLINE }),
    ).toBeTruthy();
    const [primary] = screen.getAllByRole("link", {
      name: en.logInWithDiscord,
    });
    expect(primary.getAttribute("href")).toBe(LOGIN_HREF);
    const topBar = screen.getByRole("link", { name: en.landing.topBarLogIn });
    expect(topBar.getAttribute("href")).toBe(LOGIN_HREF);
  });

  it("shows the denied-login message for ?loginError=", () => {
    renderLanding({ loginError: "login_denied" });

    expect(screen.getByRole("alert").textContent).toBe(
      en.loginErrors.login_denied,
    );
  });

  it("shows the session expired message", () => {
    renderLanding({ reason: "expired" });

    expect(screen.getByRole("alert").textContent).toBe(en.sessionExpired);
  });

  it("moves focus to the headline after logout", async () => {
    renderLanding({ reason: "loggedOut" });

    const heading = screen.getByRole("heading", { level: 1, name: HEADLINE });
    await waitFor(() => expect(document.activeElement).toBe(heading));
  });

  it("How it works moves focus to the steps section", () => {
    renderLanding();

    fireEvent.click(screen.getByRole("link", { name: en.landing.howItWorks }));

    const steps = screen.getByRole("region", { name: en.landing.stepsHeading });
    expect(document.activeElement).toBe(steps);
    expect(steps.id).toBe("how-it-works");
  });

  it("shows one card per step, two of them", () => {
    const { container } = renderLanding();

    const cards = container.querySelectorAll(".step-card");
    expect(cards).toHaveLength(en.landing.steps.length);
    expect(cards).toHaveLength(2);
    for (const step of en.landing.steps) {
      expect(screen.getByRole("heading", { name: step.title })).toBeTruthy();
    }
  });

  it("hides the app preview from assistive technology", () => {
    renderLanding();

    const sampleMember = screen.getByText("Jordan Lee");
    expect(sampleMember.closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it("loads no resource from a third-party origin", () => {
    const { container } = renderLanding();

    const addresses = container.querySelectorAll("[src], [href]");
    expect(addresses.length).toBeGreaterThan(0);
    for (const element of addresses) {
      const value = element.getAttribute("src") ?? element.getAttribute("href");
      expect(new URL(value ?? "", window.location.origin).origin).toBe(
        window.location.origin,
      );
    }
  });
});
