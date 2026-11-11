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

  it("keeps the bubble inside the window and puts it below the trigger when there is no room above", () => {
    const button = renderTooltip();
    const rect = (left: number, top: number, width: number, height: number) =>
      ({ left, top, width, height, bottom: top + height }) as DOMRect;
    vi.spyOn(button.parentElement!, "getBoundingClientRect").mockReturnValue(
      rect(window.innerWidth - 20, 2, 32, 32),
    );
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function (this: HTMLElement) {
        return this.classList.contains("tooltip__bubble")
          ? rect(0, 0, 60, 24)
          : rect(0, 0, 0, 0);
      },
    );

    fireEvent.pointerEnter(button);

    const shown = bubble()!;
    expect(shown.style.left).toBe(`${window.innerWidth - 60 - 8}px`);
    expect(shown.style.top).toBe("34px");
    expect(shown.dataset.side).toBe("below");
  });

  it("closes on scroll, since the bubble does not follow the trigger", () => {
    const button = renderTooltip();
    fireEvent.pointerEnter(button);

    fireEvent.scroll(window);
    expect(bubble()).toBeNull();
  });

  it("closes on window resize", () => {
    const button = renderTooltip();
    fireEvent.pointerEnter(button);

    fireEvent(window, new Event("resize"));
    expect(bubble()).toBeNull();
  });

  it("still shows and closes the bubble in a browser without the Popover API", () => {
    const showPopover = HTMLElement.prototype.showPopover;
    delete (HTMLElement.prototype as Partial<HTMLElement>).showPopover;
    try {
      const button = renderTooltip();

      fireEvent.pointerEnter(button);
      expect(bubble()).not.toBeNull();

      fireEvent.pointerLeave(button.parentElement!);
      expect(bubble()).toBeNull();
    } finally {
      HTMLElement.prototype.showPopover = showPopover;
    }
  });
});
