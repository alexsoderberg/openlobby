import { describe, expect, it } from "vitest";
import { en } from "../i18n/messages/en";
import { lobbyLabel } from "./lobbyLabel";

const label = (modeName?: string | null, activityName?: string | null) =>
  lobbyLabel({ gameName: "Overwatch 2", modeName, activityName }, en);

describe("lobbyLabel", () => {
  it.each([
    ["game only", undefined, undefined, "Overwatch 2"],
    ["null mode and activity", null, null, "Overwatch 2"],
    ["game and mode", "Competitive", null, "Overwatch 2 › Competitive"],
    ["game and activity", null, "Control", "Overwatch 2 › Control"],
    [
      "game, mode and activity",
      "Competitive",
      "Control",
      "Overwatch 2 › Competitive › Control",
    ],
  ])("%s", (_name, mode, activity, expected) => {
    expect(label(mode, activity)).toBe(expected);
  });
});
