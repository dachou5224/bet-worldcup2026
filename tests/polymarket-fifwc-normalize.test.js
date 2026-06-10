import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, test } from "node:test";
import { buildFixtureKey } from "../lib/match-key.js";
import {
  extractFifwcSplitBinaryH2h,
  isFifwcMatchEvent,
  normalizeFifwcMatchEvent,
  parseFifwcFixtureTitle,
  polymarketTeamToOddsBoardName,
} from "../lib/polymarket-fifwc-normalize.js";
import { mergeMarketSources } from "../services/market-board-service.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sampleEvents = JSON.parse(
  readFileSync(path.join(__dirname, "../fixtures/test/polymarket/fifwc-events-sample.json"), "utf-8"),
);

describe("polymarket fifwc normalize", () => {
  test("识别世界杯单场 slug", () => {
    assert.equal(isFifwcMatchEvent({ slug: "fifwc-mex-rsa-2026-06-11" }), true);
    assert.equal(isFifwcMatchEvent({ slug: "fifwc-mex-rsa-2026-06-11-halftime-result" }), false);
    assert.equal(isFifwcMatchEvent({ slug: "world-cup-winner" }), false);
  });

  test("解析 title 主客队", () => {
    assert.deepEqual(parseFifwcFixtureTitle("Mexico vs. South Africa"), {
      homeEnglish: "Mexico",
      awayEnglish: "South Africa",
    });
  });

  test("队名映射到 odds board 中文显示名", () => {
    assert.equal(polymarketTeamToOddsBoardName("Korea Republic"), "韩国");
    assert.equal(polymarketTeamToOddsBoardName("Bosnia-Herzegovina"), "波黑");
    assert.equal(polymarketTeamToOddsBoardName("United States"), "美国");
    assert.equal(polymarketTeamToOddsBoardName("Mexico"), "墨西哥");
  });

  test("从 3 个 Yes/No 市场合成 h2h 概率", () => {
    const event = sampleEvents.find((item) => item.slug === "fifwc-mex-rsa-2026-06-11");
    assert.ok(event, "sample fixture missing mex-rsa event");

    const h2h = extractFifwcSplitBinaryH2h(event, "Mexico", "South Africa");
    assert.ok(h2h);
    assert.ok(h2h.normalized.home > h2h.normalized.away);
    assert.ok(Math.abs(h2h.normalized.home + h2h.normalized.draw + h2h.normalized.away - 1) < 0.001);
  });

  test("normalize 后可与 odds board merge", () => {
    const event = sampleEvents.find((item) => item.slug === "fifwc-mex-rsa-2026-06-11");
    const normalized = normalizeFifwcMatchEvent(event);
    assert.ok(normalized);
    assert.equal(normalized.home, "墨西哥");
    assert.equal(normalized.away, "南非");
    assert.equal(normalized.fixtureKey, buildFixtureKey("墨西哥", "南非"));
    assert.equal(normalized.predictionMarkets[0].directEVEligible, true);
    assert.equal(normalized.predictionMarkets[0].marketStructure, "split_binary_h2h");

    const merged = mergeMarketSources({
      oddsBoard: [
        {
          fixtureKey: buildFixtureKey("墨西哥", "南非"),
          fixtureId: "8287",
          home: "墨西哥",
          away: "南非",
          kickoff: "2026-06-11T19:00:00Z",
          oddsProviders: [{ provider: "Pinnacle", odds: { home: 1.41, draw: 4.61, away: 8.75 } }],
        },
      ],
      predictionBoard: [normalized],
    });

    assert.equal(merged.length, 1);
    assert.equal(merged[0].id, "8287");
    assert.equal(merged[0].predictionMarkets.length, 1);
    assert.equal(merged[0].oddsProviders.length, 1);
  });
});
