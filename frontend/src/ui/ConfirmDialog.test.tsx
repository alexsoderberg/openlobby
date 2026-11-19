import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "../i18n/messages/en";
import { stylesheet } from "../test/cssTokens";
import { ConfirmDialog } from "./ConfirmDialog";

const HEADING = "Remove game Catan?";
const BODY = "Lobbies keep the name.";

/** The owner as the features build it: an opener, and the dialog shown until `onClose` removes it. */
function Owner({
  onConfirm,
  onClose,
  busy = false,
}: {
  onConfirm: () => Promise<string | undefined>;
  onClose: (confirmed: boolean) => void;
  busy?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Remove
      </button>
      {open && (
        <ConfirmDialog
          heading={HEADING}
          body={BODY}
          submitLabel="Yes, remove"
          submitIcon="remove"
          danger
          keepLabel="Keep"
          busy={busy}
          onConfirm={onConfirm}
          onClose={(confirmed) => {
            setOpen(false);
            onClose(confirmed);
          }}
        />
      )}
    </>
  );
}

function renderOpen(
  onConfirm: () => Promise<string | undefined> = vi.fn(async () => undefined),
) {
  const onClose = vi.fn();
  render(<Owner onConfirm={onConfirm} onClose={onClose} />);
  const opener = screen.getByRole("button", { name: "Remove" });
  opener.focus();
  fireEvent.click(opener);
  const dialog = screen.getByRole("alertdialog", { name: HEADING });
  return { dialog, opener, onConfirm, onClose };
}

const keep = () => screen.getByRole("button", { name: "Keep" });
const submit = () => screen.getByRole("button", { name: "Yes, remove" });

describe("ConfirmDialog", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("is an alert dialog named by its heading, with Keep focused", async () => {
    const { dialog } = renderOpen();
    expect(dialog.textContent).toContain(BODY);
    expect(dialog.getAttribute("aria-describedby")).toBe(
      screen.getByText(BODY).id,
    );
    await waitFor(() => expect(document.activeElement).toBe(keep()));
  });

  it("marks a destructive confirm danger, with visible text, and Keep secondary", () => {
    renderOpen();
    expect(submit().dataset.variant).toBe("danger");
    expect(submit().textContent).toBe("Yes, remove");
    expect(keep().dataset.variant).toBe("secondary");
  });

  it.each([
    ["Keep", () => fireEvent.click(keep())],
    [
      "Escape",
      () => fireEvent.keyDown(document.activeElement!, { key: "Escape" }),
    ],
    [
      "the overlay",
      () =>
        fireEvent.click(
          document.querySelector('[data-slot="alert-dialog-overlay"]')!,
        ),
    ],
  ])("closes on %s without the action and returns focus", async (_, close) => {
    const { opener, onConfirm, onClose } = renderOpen();
    await waitFor(() => expect(document.activeElement).toBe(keep()));
    close();
    await waitFor(() => expect(onClose).toHaveBeenCalledWith(false));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it("keeps a refusal in the dialog, where it is read", async () => {
    const { dialog, onClose } = renderOpen(vi.fn(async () => "not_allowed"));
    fireEvent.click(submit());
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(dialog.textContent).toContain(en.errors.not_allowed);
    expect(screen.getByRole("alertdialog")).toBe(dialog);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes after a success and tells the owner it was confirmed", async () => {
    const { opener, onClose } = renderOpen();
    fireEvent.click(submit());
    await waitFor(() => expect(onClose).toHaveBeenCalledWith(true));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it("stays open while the action runs, so its outcome is never missed", async () => {
    let finish: (code: string | undefined) => void = () => undefined;
    const { onClose } = renderOpen(
      () => new Promise<string | undefined>((resolve) => (finish = resolve)),
    );
    fireEvent.click(submit());
    await waitFor(() => expect(keep()).toHaveProperty("disabled", true));
    expect(submit()).toHaveProperty("disabled", true);
    fireEvent.keyDown(screen.getByRole("alertdialog"), { key: "Escape" });
    expect(screen.getByRole("alertdialog")).toBeTruthy();

    finish(undefined);
    await waitFor(() => expect(onClose).toHaveBeenCalledWith(true));
  });

  // ADR 0023 point 5 ASSUMPTION, checked: Radix calls onCloseAutoFocus only once the exit animation has ended.
  // jsdom's computed style is a snapshot and runs no animation, so the closed state's animation is faked here.
  it("tells the owner only after the exit animation has ended", async () => {
    // Radix matches the ended animation by CSS.escape, which jsdom lacks.
    vi.stubGlobal("CSS", { escape: (name: string) => name });
    const computed = window.getComputedStyle;
    vi.spyOn(window, "getComputedStyle").mockImplementation((element) => {
      const style = computed(element);
      return new Proxy(style, {
        get: (target, key) =>
          key === "animationName"
            ? element.getAttribute("data-state") === "closed"
              ? "dialog-exit"
              : "none"
            : Reflect.get(target, key, target),
      });
    });
    const { onClose } = renderOpen();
    fireEvent.click(keep());

    const content = screen.getByRole("alertdialog");
    expect(content.dataset.state).toBe("closed");
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(onClose).not.toHaveBeenCalled();

    const overlay = document.querySelector(
      '[data-slot="alert-dialog-overlay"]',
    )!;
    // jsdom has no AnimationEvent, so the name is set on a plain event.
    for (const node of [content, overlay]) {
      const ended = Object.assign(new Event("animationend"), {
        animationName: "dialog-exit",
      });
      act(() => node.dispatchEvent(ended));
    }
    await waitFor(() => expect(onClose).toHaveBeenCalledWith(false));
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("animates in and out, and reduced motion turns it off", () => {
    expect(stylesheet).toMatch(
      /\[data-slot="alert-dialog-content"\]\[data-state="closed"\]\s*\{\s*animation:/,
    );
    // The reduced-motion block stops every animation, so Radix finds none and shows the final state at once.
    expect(stylesheet).toMatch(
      /prefers-reduced-motion: reduce\)\s*\{\s*\*,\s*\*::before,\s*\*::after\s*\{[^}]*animation: none !important/,
    );
  });
});
