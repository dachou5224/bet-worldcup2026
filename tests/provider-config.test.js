import test from "node:test";
import assert from "node:assert/strict";
import { getProviderConfig } from "../provider-config.js";
import { buildFixtureKey } from "../lib/match-key.js";

test("provider config exposes the odds and football-data window defaults", () => {
  const previousEnv = {
    JINGCAI_OFFICIAL_FEED_MODE: process.env.JINGCAI_OFFICIAL_FEED_MODE,
    MARKET_DATA_MODE: process.env.MARKET_DATA_MODE,
    LIVE_DATA_MODE: process.env.LIVE_DATA_MODE,
    POLYMARKET_HTTPS_PROXY: process.env.POLYMARKET_HTTPS_PROXY,
  };

  delete process.env.JINGCAI_OFFICIAL_FEED_MODE;
  process.env.MARKET_DATA_MODE = "real";
  process.env.LIVE_DATA_MODE = "real";
  process.env.POLYMARKET_HTTPS_PROXY = "127.0.0.1:3213";

  try {
    const config = getProviderConfig();

    assert.deepEqual(config.oddsMarkets, ["h2h"]);
    assert.equal(config.oddsCommenceTimeFrom, "2026-06-11T00:00:00Z");
    assert.equal(config.oddsCommenceTimeTo, "2026-07-19T23:59:59Z");
    assert.equal(config.footballDataCompetitionCode, "WC");
    assert.equal(config.jingcaiOfficialFeedMode, "webapi");
    assert.equal(config.jingcaiOfficialFeedFile, "./fixtures/snapshots/latest/jingcai-official-feed.json");
    assert.equal(config.jingcaiOfficialFeedUrl, "");
    assert.equal(config.polymarketHttpsProxy, "http://127.0.0.1:3213");
    assert.equal(config.postMatchReviewFile, "./fixtures/snapshots/post-match-review.json");
    assert.equal(config.backtestRunFile, "./fixtures/snapshots/backtest-run.json");
    assert.equal(config.liveSnapshotReplayEnabled, false);
    assert.equal(config.liveSnapshotReplayFile, "./fixtures/snapshots/latest/live-data.json");
    assert.equal(config.polymarketPublicEnabled, true);
    assert.equal(config.enableStakeSuggestion, false);
  } finally {
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value == null) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
});

test("fixture key normalizes Turkiye aliases to the same key", () => {
  const a = buildFixtureKey("澳大利亚", "Turkiye");
  const b = buildFixtureKey("澳大利亚", "土耳其");
  const c = buildFixtureKey("Australia", "Türkiye");

  assert.equal(a, b);
  assert.equal(a, c);
});
