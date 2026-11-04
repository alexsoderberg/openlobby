import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useLoad } from "../hooks";
import { trackLoad } from "../hooks/pageLoads";
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

  describe("holding the transition for the new page's data", () => {
    let finish: (value: string) => void;
    const load = () => new Promise<string>((resolve) => (finish = resolve));
    function Page() {
      const { state } = useLoad(load);
      return <p>{state.status === "loaded" ? state.value : "loading"}</p>;
    }
    function Router() {
      return usePathname() === "/slow" ? <Page /> : null;
    }
    function startTransitions() {
      const transitions: Promise<void>[] = [];
      Object.assign(document, {
        startViewTransition: (update: () => Promise<void>) => {
          transitions.push(update());
        },
      });
      return transitions;
    }

    it("releases only after the loaded page is on screen", async () => {
      const transitions = startTransitions();
      render(<Router />);
      let released = false;

      act(() => navigate("/slow"));
      void transitions[0].then(() => {
        released = true;
        expect(screen.getByText("done")).toBeTruthy();
      });
      await act(async () => {});
      expect(released).toBe(false);
      await act(async () => finish("done"));

      expect(released).toBe(true);
    });

    it("does not wait for a load of the page being left", async () => {
      const transitions = startTransitions();
      trackLoad(new Promise(() => {}));
      render(<Router />);

      act(() => navigate("/other"));

      await expect(transitions[0]).resolves.toBeUndefined();
    });
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

  it("neither animates nor scrolls when only the query changes", () => {
    window.history.replaceState(null, "", "/groups");
    const start = vi.fn((update: () => void) => update());
    Object.assign(document, { startViewTransition: start });
    const scroll = vi.spyOn(window, "scrollTo");
    render(<Probe />);

    act(() => navigate("/groups?tab=x"));

    expect(start).not.toHaveBeenCalled();
    expect(scroll).not.toHaveBeenCalled();
    scroll.mockRestore();
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
