import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { navigate, usePathname } from "./navigation";

function Probe() {
  const pathname = usePathname();
  return (
    <>
      <output>{pathname}</output>
      <a href="/groups">Groups</a>
      <a href="/api/auth/login">Login</a>
    </>
  );
}

afterEach(() => {
  Reflect.deleteProperty(document, "startViewTransition");
  window.history.replaceState(null, "", "/");
});

describe("page navigation", () => {
  it("runs the page change inside a view transition when the browser has them", () => {
    const start = vi.fn((update: () => void) => update());
    Object.assign(document, { startViewTransition: start });
    render(<Probe />);

    act(() => navigate("/profile"));

    expect(start).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status").textContent).toBe("/profile");
    expect(window.location.pathname).toBe("/profile");
  });

  it("changes the page directly when there are no view transitions", () => {
    render(<Probe />);

    fireEvent.click(screen.getByRole("link", { name: "Groups" }));

    expect(screen.getByRole("status").textContent).toBe("/groups");
  });

  it("follows back and forward", () => {
    render(<Probe />);
    act(() => navigate("/groups"));

    act(() => {
      window.history.replaceState(null, "", "/games");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    expect(screen.getByRole("status").textContent).toBe("/games");
  });

  it("leaves the login endpoint to the browser", () => {
    render(<Probe />);
    let handledByApp = true;
    window.addEventListener(
      "click",
      (event) => {
        handledByApp = event.defaultPrevented;
        event.preventDefault(); // jsdom cannot load another document
      },
      { once: true },
    );

    fireEvent.click(screen.getByRole("link", { name: "Login" }));

    expect(handledByApp).toBe(false);
    expect(window.location.pathname).toBe("/");
  });
});
