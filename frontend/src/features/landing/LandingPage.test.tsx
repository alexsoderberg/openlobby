import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { en } from "../../i18n/messages/en";
import { LandingPage } from "./LandingPage";

const LOGIN_HREF = "/api/auth/login?returnTo=%2F";
const HEADLINE = en.landing.headline;

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

  it("has the headline then Discord login first in focus order, and no How it works link", () => {
    renderLanding();

    const focusable = screen
      .getAllByRole("link")
      .filter((link) => link.closest("main"));
    expect(focusable[0].textContent).toBe(en.logInWithDiscord);
    expect(screen.getByRole("heading", { level: 1 }).tabIndex).toBe(-1);
    expect(screen.queryByRole("link", { name: "How it works" })).toBeNull();
    expect(
      screen.getByRole("region", { name: en.landing.stepsHeading }),
    ).toBeTruthy();
  });

  it("shows one card per step, four of them", () => {
    const { container } = renderLanding();

    const cards = container.querySelectorAll(".step-card");
    expect(cards).toHaveLength(en.landing.steps.length);
    expect(cards).toHaveLength(4);
    for (const [index, step] of en.landing.steps.entries()) {
      expect(
        screen.getByRole("heading", {
          level: 3,
          name: `${index + 1}. ${step.title}`,
        }),
      ).toBeTruthy();
      expect(screen.getByText(step.text)).toBeTruthy();
    }
  });

  it("shows no sample member list and no sample invite links", () => {
    renderLanding();

    expect(screen.queryByText("Jordan Lee")).toBeNull();
    expect(screen.queryByText(en.inviteLinksHeading)).toBeNull();
    expect(screen.queryByText(en.groupAdminMarker)).toBeNull();
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
