import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  buildDraftFeedFromGeminiResponse,
  buildMatchKey,
  diffDraftAgainstBaseline,
  filterOfficialGeminiMatches,
  normalizeGeminiMatchToRecord,
} from "../lib/jingcai-gemini-draft.js";

const baselineEnvelope = {
  capturedAt: "2026-06-09T03:00:00+08:00",
  matches: [
    {
      jingcaiMatchId: "JC-2026-8287",
      fixtureId: 8287,
      competition: "2026 FIFA World Cup",
      stage: "小组赛第1轮",
      homeTeam: "墨西哥",
      awayTeam: "南非",
      kickoffLocal: "2026-06-12T03:00:00+08:00",
      stopSaleTime: "2026-06-12T02:55:00+08:00",
      availablePlays: {
        spf: { onSale: true, odds: { "0": 7.5, "1": 4.2, "3": 1.48 } },
        rqspf: { onSale: true, handicap: -1, odds: { "0": 2.05, "1": 3.65, "3": 2.85 } },
        zjq: { onSale: false, odds: {} },
        bf: { onSale: false, odds: {} },
        bqc: { onSale: false, odds: {} },
      },
      ruleVersion: "2026-jczq-football",
      fetchedAt: "2026-06-09T03:00:00+08:00",
    },
  ],
};

describe("jingcai-gemini-draft", () => {
  test("buildMatchKey normalizes team names", () => {
    assert.equal(buildMatchKey("墨西哥", "南非"), buildMatchKey(" 墨西哥 ", "南非"));
  });

  test("normalizeGeminiMatchToRecord maps spf to 3/1/0 odds keys", () => {
    const record = normalizeGeminiMatchToRecord(
      {
        homeTeam: "墨西哥",
        awayTeam: "南非",
        spf: { win: 1.31, draw: 4.1, lose: 8.3 },
        rqspf: { handicap: -1, win: 2.13, draw: 3.28, lose: 2.82 },
        stopSaleTime: "2026-06-11T22:00:00+08:00",
      },
      baselineEnvelope.matches[0],
      "2026-06-09T06:00:00+08:00",
    );

    assert.equal(record.fixtureId, 8287);
    assert.equal(record.availablePlays.spf.odds["3"], 1.31);
    assert.equal(record.availablePlays.spf.odds["1"], 4.1);
    assert.equal(record.availablePlays.spf.odds["0"], 8.3);
    assert.equal(record.manualReviewed, undefined);
    assert.equal(record.saleStatus, "on_sale");
  });

  test("buildDraftFeedFromGeminiResponse marks draft envelope", () => {
    const draft = buildDraftFeedFromGeminiResponse(
      {
        found: true,
        matches: [
          {
            homeTeam: "墨西哥",
            awayTeam: "南非",
            spf: { win: 1.31, draw: 4.1, lose: 8.3 },
            rqspf: { handicap: -1, win: 2.13, draw: 3.28, lose: 2.82 },
          },
        ],
        note: "test",
      },
      baselineEnvelope,
      { capturedAt: "2026-06-09T06:00:00+08:00" },
    );

    assert.equal(draft.source, "gemini_search_draft");
    assert.equal(draft.manualReviewed, false);
    assert.equal(draft.directEVEligible, false);
    assert.equal(draft.matches.length, 1);
  });

  test("diffDraftAgainstBaseline detects odds and stopSaleTime changes", () => {
    const draft = buildDraftFeedFromGeminiResponse(
      {
        found: true,
        matches: [
          {
            homeTeam: "墨西哥",
            awayTeam: "南非",
            spf: { win: 1.31, draw: 4.1, lose: 8.3 },
            rqspf: { handicap: -1, win: 2.13, draw: 3.28, lose: 2.82 },
            stopSaleTime: "2026-06-11T22:00:00+08:00",
          },
        ],
      },
      baselineEnvelope,
      { capturedAt: "2026-06-09T06:00:00+08:00" },
    );

    const diff = diffDraftAgainstBaseline(draft, baselineEnvelope);
    assert.equal(diff.changedCount, 1);
    assert.ok(diff.items[0].changes.some((line) => line.startsWith("spf.3")));
    assert.ok(diff.items[0].changes.some((line) => line.startsWith("stopSaleTime")));
  });

  test("filterOfficialGeminiMatches rejects non-official sourceUrl", () => {
    const filtered = filterOfficialGeminiMatches(
      {
        found: true,
        matches: [
          {
            homeTeam: "墨西哥",
            awayTeam: "南非",
            sourceUrl: "https://info.500.com/gocheck/jingcai/spf.php",
          },
          {
            homeTeam: "加拿大",
            awayTeam: "波黑",
            sourceUrl: "https://www.sporttery.cn/jc/zqszsc/",
          },
        ],
      },
      ["sporttery.cn"],
    );

    assert.equal(filtered.matches.length, 1);
    assert.equal(filtered.rejected.length, 1);
    assert.equal(filtered.matches[0].homeTeam, "加拿大");
  });
});
