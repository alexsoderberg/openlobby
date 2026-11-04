import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../../api";
import { en } from "../../i18n/messages/en";
import { MyGroups } from "./MyGroups";
import type { GroupsState } from "./useMyGroups";

function renderGroups(state: GroupsState, onRetry = vi.fn()) {
  render(<MyGroups state={state} onRetry={onRetry} />);
  return { onRetry };
}

describe("group list", () => {
  it("links each group to its group page", () => {
    renderGroups({
      status: "loaded",
      groups: [{ id: "g1", name: "Friday crew" }],
    });

    const link = screen.getByRole("link", { name: "Friday crew" });
    expect(link.getAttribute("href")).toBe("/groups/g1");
  });

  it("shows the empty state when the user is in no group", () => {
    renderGroups({ status: "loaded", groups: [] });
    expect(screen.getByText(en.groupsEmpty)).toBeTruthy();
  });

  it("shows the error with a retry", () => {
    const { onRetry } = renderGroups({
      status: "error",
      code: new ApiError(503, "service_unavailable").code,
    });

    expect(screen.getByRole("alert").textContent).toBe(
      en.errors.service_unavailable,
    );
    fireEvent.click(screen.getByRole("button", { name: en.tryAgain }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
