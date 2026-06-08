import test from "node:test";
import assert from "node:assert/strict";
import { getProviderConfig } from "../provider-config.js";

test("provider config exposes the odds and football-data window defaults", () => {
  const config = getProviderConfig();

  assert.equal(config.oddsMarkets.includes("h2h"), true);
  assert.equal(config.oddsCommenceTimeFrom, "2026-06-11T00:00:00Z");
  assert.equal(config.oddsCommenceTimeTo, "2026-07-19T23:59:59Z");
  assert.equal(config.footballDataCompetitionCode, "WC");
  assert.equal(config.jingcaiOfficialFeedMode, "fixture");
  assert.equal(config.jingcaiOfficialFeedFile, "./fixtures/jingcai-official-feed.json");
  assert.equal(config.jingcaiOfficialFeedUrl, "");
  assert.equal(config.postMatchReviewFile, "./fixtures/snapshots/post-match-review.json");
  assert.equal(config.backtestRunFile, "./fixtures/snapshots/backtest-run.json");
});
