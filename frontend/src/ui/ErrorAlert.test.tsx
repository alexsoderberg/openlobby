import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { en } from "../i18n/messages/en";
import { ErrorAlert } from "./ErrorAlert";

describe("ErrorAlert", () => {
  it("shows the generic text for a code without a message and offers a retry", () => {
    const onRetry = vi.fn();
    render(<ErrorAlert code="made_up_code" onRetry={onRetry} />);

    expect(screen.getByRole("alert").textContent).toBe(en.genericError);
    fireEvent.click(screen.getByRole("button", { name: en.tryAgain }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
