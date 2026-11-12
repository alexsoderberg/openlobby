import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { dayColumns } from "../test/weekGrid";
import { weekItems, weekStartOf } from "./week";
import { WeekTimeGrid } from "./WeekTimeGrid";

// Wednesday 4 November 2026, half a minute before midnight. The week runs Monday 2 to Sunday 8.
const BEFORE_MIDNIGHT = new Date(2026, 10, 4, 23, 59, 30);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
  vi.setSystemTime(BEFORE_MIDNIGHT);
});
afterEach(() => vi.useRealTimers());

const nowLines = () =>
  document.querySelectorAll<HTMLElement>(".time-grid__now");

it("moves the Now line into the next day's column after midnight", () => {
  render(
    <WeekTimeGrid
      days={weekItems(weekStartOf(BEFORE_MIDNIGHT), [])}
      titleLevel={3}
      hrefOf={() => "#"}
      genreOf={() => null}
    />,
  );
  expect(nowLines()[0].closest("li")).toBe(dayColumns()[2]);
  expect(nowLines()[0].style.getPropertyValue("--now")).toBe(
    String(23 * 60 + 59),
  );

  act(() => vi.advanceTimersByTime(60_000));

  expect(nowLines()).toHaveLength(1);
  expect(nowLines()[0].closest("li")).toBe(dayColumns()[3]);
  expect(nowLines()[0].style.getPropertyValue("--now")).toBe("0");
});
