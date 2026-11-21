import { act, screen, within } from "@testing-library/react";
import { expect } from "vitest";

const toastRegion = () =>
  screen.getByRole("region", { name: /notifications/i });

/** Finds a toast by its text in the toast region; the test renders a `Toaster`. */
export const findToast = (text: string) =>
  within(toastRegion()).findByText(text);

/** Asserts that no toast is shown. sonner hands a toast to the region in a timeout, so one is waited out first. */
export async function expectNoToast() {
  await act(() => new Promise<void>((resolve) => setTimeout(resolve)));
  expect(toastRegion().querySelector("[data-sonner-toast]")).toBeNull();
}
