import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useStoredChoice } from "./useStoredChoice";

const CHOICES = ["calendar", "days"] as const;
const refuse = () => {
  throw new DOMException("refused", "SecurityError");
};
const choice = () =>
  renderHook(() => useStoredChoice("key", CHOICES, "calendar"));

afterEach(() => vi.unstubAllGlobals());

describe("useStoredChoice", () => {
  it("returns the fallback when the browser refuses to read", () => {
    vi.stubGlobal("localStorage", { getItem: refuse });
    expect(choice().result.current[0]).toBe("calendar");
  });

  it("still switches, without throwing, when the browser refuses to save", () => {
    vi.stubGlobal("localStorage", { getItem: () => null, setItem: refuse });
    const { result } = choice();

    act(() => result.current[1]("days"));

    expect(result.current[0]).toBe("days");
  });

  it("returns the fallback for a stored value that is not a choice", () => {
    vi.stubGlobal("localStorage", { getItem: () => "month" });
    expect(choice().result.current[0]).toBe("calendar");
  });

  it("returns a stored choice", () => {
    vi.stubGlobal("localStorage", { getItem: () => "days" });
    expect(choice().result.current[0]).toBe("days");
  });
});
