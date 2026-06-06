import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatOpeningDayNote } from "../providers/live/opening-day.js";

describe("opening-day", () => {
  it("uses configured opening date in appended note", () => {
    const note = formatOpeningDayNote("来自 football-data.org 实时比赛源。", "2026-06-12");
    assert.match(note, /6 月 12 日/);
    assert.doesNotMatch(note, /6 月 11 日/);
  });
});
