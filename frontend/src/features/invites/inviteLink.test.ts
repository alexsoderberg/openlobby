import { describe, expect, it } from "vitest";
import { formatExpiry, inviteUrl } from "./inviteLink";

describe("inviteUrl", () => {
  it("is the full address of the invite page", () => {
    expect(inviteUrl("tok-1")).toBe(`${window.location.origin}/invite/tok-1`);
  });
});

describe("formatExpiry", () => {
  it("shows the medium date and short time in the user's locale and time zone", () => {
    const expiresAt = "2026-11-03T20:00:00Z";
    const expected = new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(expiresAt));

    expect(formatExpiry(expiresAt)).toBe(expected);
  });
});
