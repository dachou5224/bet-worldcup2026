import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { beijingDateKey, isSameBeijingDay } from "../lib/beijing-time.js";
import { formatKickoff } from "../app/format.js";

describe("beijing-time", () => {
  it("将 UTC 开球时间换算为北京时间", () => {
    assert.equal(formatKickoff("2026-06-11T19:00:00Z"), "06/12 03:00");
    assert.equal(beijingDateKey("2026-06-11T19:00:00Z"), "2026-06-12");
  });

  it("保留纯日历日期字符串", () => {
    assert.equal(beijingDateKey("2026-06-11"), "2026-06-11");
  });

  it("按北京时间判断同一天", () => {
    assert.equal(isSameBeijingDay("2026-06-11T18:00:00Z", "2026-06-12T01:00:00+08:00"), true);
    assert.equal(isSameBeijingDay("2026-06-11T15:00:00Z", "2026-06-12T01:00:00+08:00"), false);
  });
});
