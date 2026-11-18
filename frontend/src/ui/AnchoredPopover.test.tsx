import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AnchoredPopover } from "./AnchoredPopover";

const LABEL = "Catan: Tank, Healer";
const TEXT = "Plays Tank or Healer in Catan.";

function renderPopover() {
  render(
    <>
      <AnchoredPopover triggerLabel={LABEL} content={<p>{TEXT}</p>}>
        <span aria-hidden="true">CA</span>
      </AnchoredPopover>
      <p>Outside</p>
    </>,
  );
  return screen.getByRole("button", { name: LABEL });
}

/** Opens with a click, waits for Radix to move focus into the panel, then one tick: Radix listens for outside
 *  presses only from then on. */
async function open(trigger: HTMLElement) {
  fireEvent.click(trigger);
  await waitFor(() => expect(document.activeElement).not.toBe(trigger));
  await new Promise((resolve) => setTimeout(resolve));
}

describe("AnchoredPopover", () => {
  it("is a native button named by triggerLabel, closed at first", () => {
    const trigger = renderPopover();
    expect(trigger.tagName).toBe("BUTTON");
    expect(trigger).toHaveProperty("type", "button");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText(TEXT)).toBeNull();
  });

  it("opens the content on a click", async () => {
    const trigger = renderPopover();
    await open(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText(TEXT)).toBeTruthy();
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    const trigger = renderPopover();
    await open(trigger);
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    await waitFor(() => expect(screen.queryByText(TEXT)).toBeNull());
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(trigger);
  });

  it("closes on a click outside", async () => {
    const trigger = renderPopover();
    await open(trigger);
    // Radix waits for the click that ends a primary-button press before it dismisses.
    const outside = screen.getByText("Outside");
    fireEvent.pointerDown(outside);
    fireEvent.click(outside);
    await waitFor(() => expect(screen.queryByText(TEXT)).toBeNull());
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });
});
