import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { en } from "../i18n/messages/en";
import { GENRE_OPTIONS } from "./genreOptions";

const contract = readFileSync(
  join(import.meta.dirname, "../../../api/calendar/openapi.yaml"),
  "utf8",
);
const contractGenres = (
  /^ {4}Genre:\s+type: string\s+enum: \[([^\]]*)\]/m.exec(contract)?.[1] ?? ""
).split(/,\s*/);

describe("genre options", () => {
  it("offers exactly the contract genres", () => {
    expect([...GENRE_OPTIONS].sort()).toEqual([...contractGenres].sort());
  });

  it("has a label for every genre and for no genre", () => {
    expect(Object.keys(en.genre).sort()).toEqual(
      [...contractGenres, "none"].sort(),
    );
  });
});
