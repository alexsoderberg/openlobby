import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cssRules } from "../test/cssTokens";
import { showToast, TOAST_DURATION_MS, Toaster } from "./Toast";

// sonner unmounts a toast after its exit (TIME_BEFORE_UNMOUNT in sonner 2.0.8); a dismissal reaches it a frame later.
const EXIT_MS = 200;
const FRAME_MS = 16;
// A step shorter than the duration, to look just before a timer would end.
const SHORT_MS = 100;

const region = () => screen.getByRole("region", { name: /notifications/i });
const toastOf = (text: string) =>
  screen.getByText(text).closest<HTMLElement>("[data-sonner-toast]");

// sonner hands a new toast to the region in a timeout.
function show(message: string) {
  act(() => showToast(message));
  wait(0);
}

function wait(ms: number) {
  act(() => vi.advanceTimersByTime(ms));
}

beforeEach(() => {
  vi.useFakeTimers();
  render(
    <>
      <button type="button">Save</button>
      <Toaster />
    </>,
  );
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Toast", () => {
  it("is read politely in the region, has no control and leaves focus where it was", () => {
    const save = screen.getByRole("button", { name: "Save" });
    save.focus();

    show("Link copied.");

    expect(region().getAttribute("aria-live")).toBe("polite");
    expect(region().textContent).toContain("Link copied.");
    expect(region().querySelectorAll("button, a")).toHaveLength(0);
    expect(document.activeElement).toBe(save);
  });

  it("shows one toast at a time: a second one replaces the first", () => {
    show("Game changed.");
    show("Game removed.");
    wait(FRAME_MS);
    wait(EXIT_MS);

    expect(screen.queryByText("Game changed.")).toBeNull();
    expect(region().querySelectorAll("[data-sonner-toast]")).toHaveLength(1);
  });

  it("is removed once its duration has passed, leaving nothing on the page", () => {
    show("Saved.");
    wait(TOAST_DURATION_MS + EXIT_MS);

    expect(screen.queryByText("Saved.")).toBeNull();
  });

  it("takes its toasts away when the region unmounts, so a later region starts empty", () => {
    show("Saved.");
    cleanup();

    render(<Toaster />);
    wait(0);

    expect(screen.queryByText("Saved.")).toBeNull();
  });

  it("pauses while the pointer is over it", () => {
    show("Saved.");
    fireEvent.mouseEnter(toastOf("Saved.")!);
    wait(2 * TOAST_DURATION_MS);
    expect(screen.getByText("Saved.")).toBeTruthy();

    fireEvent.mouseLeave(toastOf("Saved.")!);
    wait(TOAST_DURATION_MS + EXIT_MS);
    expect(screen.queryByText("Saved.")).toBeNull();
  });

  // The timer restarts at the full duration once focus leaves (ADR 0023 Amendment 2026-11-21): sonner resets its
  // time left whenever the duration changes.
  it("pauses while keyboard focus is in the region, and restarts its full duration once it leaves", () => {
    const save = screen.getByRole("button", { name: "Save" });
    show("Saved.");
    wait(TOAST_DURATION_MS - SHORT_MS);
    act(() => toastOf("Saved.")!.focus());
    wait(2 * TOAST_DURATION_MS);
    expect(screen.getByText("Saved.")).toBeTruthy();

    act(() => save.focus());
    wait(TOAST_DURATION_MS - SHORT_MS);
    expect(screen.getByText("Saved.")).toBeTruthy();
    wait(SHORT_MS + EXIT_MS + FRAME_MS);
    expect(screen.queryByText("Saved.")).toBeNull();
  });

  it("holds a toast shown while keyboard focus is already in the region", () => {
    show("Game changed.");
    act(() => region().focus());

    show("Game removed.");
    wait(2 * TOAST_DURATION_MS);

    expect(screen.getByText("Game removed.")).toBeTruthy();
  });

  it("does not bring back a dismissed toast when focus enters the region during its exit", () => {
    show("Game changed.");
    act(() => showToast("Game removed."));
    act(() => toastOf("Game changed.")!.focus());
    wait(0);
    wait(FRAME_MS);
    wait(EXIT_MS);
    // Focus leaves and comes back: the region holds what it shows, never the dismissed toast.
    act(() => screen.getByRole("button", { name: "Save" }).focus());
    act(() => toastOf("Game removed.")!.focus());
    wait(0);

    expect(screen.queryByText("Game changed.")).toBeNull();
  });
});

describe("Toast style (ADR 0023 point 4)", () => {
  // Only the toast rules: jsdom cannot compute the whole of global.css.
  const toastRules = cssRules.filter(
    ({ selector, scopes }) =>
      selector.includes("data-sonner") && !scopes.length,
  );
  const style = document.createElement("style");
  beforeEach(() => {
    style.textContent = toastRules
      .map(({ selector, body }) => `${selector} {${body}}`)
      .join("\n");
    document.head.append(style);
  });
  afterEach(() => style.remove());

  // ADR 0028 section 16.3: a raised panel with text-colour text, a rule-strong edge and the large radius, no shadow.
  it("is a raised panel with a strong edge and text-colour text", () => {
    show("Saved.");
    const { classList, className } = toastOf("Saved.")!;

    for (const name of [
      "bg-(--color-raised)",
      "text-(--color-text)",
      "border-(--color-rule-strong)",
      "rounded-(--radius)",
    ])
      expect(classList).toContain(name);
    expect(className).not.toMatch(/shadow/);
  });

  it("moves only transform and opacity, and its exit is a fade", () => {
    show("Saved.");
    const toast = toastOf("Saved.")!;

    expect(getComputedStyle(toast).transitionProperty).toBe(
      "transform, opacity",
    );
    toast.dataset.removed = "true";
    expect(getComputedStyle(toast).transform).toBe("none");
  });

  // Below 600px sonner's own rules ([data-sonner-toaster], [data-sonner-toaster] [data-sonner-toast]) stretch the
  // toast across the window. These rules are more specific and in no media query, so the corner holds (REQ-0022).
  it("keeps the toast a bottom-right corner card at every width", () => {
    const body = (selector: string) =>
      toastRules.find((rule) => rule.selector === selector)?.body ?? "";
    const toaster = '[data-sonner-toaster][data-x-position="right"]';

    expect(body(toaster)).toMatch(/left:\s*auto/);
    expect(body(toaster)).toMatch(/width:\s*min\(var\(--width-toast\)/);
    expect(body(`${toaster} [data-sonner-toast]`)).toMatch(/width:\s*auto/);
  });
});
