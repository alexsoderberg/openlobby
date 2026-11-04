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
      <a href="/groups" target="_blank">
        Blank
      </a>
      <a href="/groups" download>
        Download
      </a>
      <a href="https://example.com/groups">External</a>
      <a href="/\evil.example">Backslash</a>
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

  it("changes the page directly when the user prefers reduced motion", () => {
    const start = vi.fn();
    Object.assign(document, { startViewTransition: start });
    const matchMedia = window.matchMedia;
    window.matchMedia = () => ({ matches: true }) as MediaQueryList;
    render(<Probe />);

    act(() => navigate("/profile"));

    window.matchMedia = matchMedia;
    expect(start).not.toHaveBeenCalled();
    expect(screen.getByRole("status").textContent).toBe("/profile");
  });

  it("does not add a history entry for the page it is already on", () => {
    render(<Probe />);
    const push = vi.spyOn(window.history, "pushState");

    act(() => navigate("/"));

    expect(push).not.toHaveBeenCalled();
    push.mockRestore();
  });

  describe("leaves to the browser", () => {
    function clickIsHandledByApp(
      name: string,
      init: MouseEventInit = {},
    ): boolean {
      render(<Probe />);
      const push = vi.spyOn(window.history, "pushState");
      let prevented = true;
      window.addEventListener(
        "click",
        (event) => {
          prevented = event.defaultPrevented;
          event.preventDefault(); // jsdom cannot load another document
        },
        { once: true },
      );
      fireEvent.click(screen.getByRole("link", { name }), init);
      const pushed = push.mock.calls.length > 0;
      push.mockRestore();
      return prevented && pushed;
    }

    it.each([
      ["Login", {}],
      ["Blank", {}],
      ["Download", {}],
      ["External", {}],
      ["Backslash", {}],
      ["Groups", { ctrlKey: true }],
      ["Groups", { metaKey: true }],
      ["Groups", { shiftKey: true }],
      ["Groups", { altKey: true }],
      ["Groups", { button: 1 }],
    ] as [string, MouseEventInit][])("%s %j", (name, init) => {
      expect(clickIsHandledByApp(name, init)).toBe(false);
      expect(window.location.pathname).toBe("/");
    });
  });
});
