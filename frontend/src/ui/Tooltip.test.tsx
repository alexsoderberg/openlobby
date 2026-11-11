import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Tooltip } from "./Tooltip";

const LABEL = "Edit";

function renderTooltip() {
  render(
    <Tooltip label={LABEL}>
      <button type="button" aria-label={LABEL} />
    </Tooltip>,
  );
  return screen.getByRole("button", { name: LABEL });
}

const bubble = () => screen.queryByText(LABEL);

describe("Tooltip", () => {
  afterEach(() => vi.restoreAllMocks());

  it("shows on pointer enter, stays while the pointer moves onto the bubble and hides on leave", () => {
    const button = renderTooltip();
    expect(bubble()).toBeNull();

    fireEvent.pointerEnter(button);
    expect(bubble()?.getAttribute("aria-hidden")).toBe("true");

    fireEvent.pointerOut(button, { relatedTarget: bubble() });
    expect(bubble()).not.toBeNull();

    fireEvent.pointerOut(bubble()!, { relatedTarget: document.body });
    expect(bubble()).toBeNull();
  });

  it("shows on keyboard focus and hides on blur", () => {
    const button = renderTooltip();

    act(() => button.focus());
    expect(button.matches(":focus-visible")).toBe(true);
    expect(bubble()).not.toBeNull();

    act(() => button.blur());
    expect(bubble()).toBeNull();
  });

  it("does not show on a focus that is not focus-visible, such as a mouse click", () => {
    const button = renderTooltip();
    vi.spyOn(button, "matches").mockReturnValue(false);

    act(() => button.focus());
    expect(bubble()).toBeNull();
  });

  it("closes on Escape and opens again on the next pointer enter", () => {
    const button = renderTooltip();
    fireEvent.pointerEnter(button);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(bubble()).toBeNull();

    fireEvent.pointerLeave(button.parentElement!);
    fireEvent.pointerEnter(button);
    expect(bubble()).not.toBeNull();
  });
});
