import test from "node:test";
import assert from "node:assert/strict";
import { getMarketDataBundle, getStaticPageData, getProviderStatus } from "../data-sources.js";
import { getPipelineData } from "../dashboard-data.js";
import { buildDataQualityReport } from "../data-hub.js";

function setEnv(overrides) {
  const previous = {};

  for (const [key, value] of Object.entries(overrides)) {
    previous[key] = process.env[key];
    process.env[key] = value;
  }

  return () => {
    for (const [key, value] of Object.entries(previous)) {
      if (value == null) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  };
}

test("explicit replay mode can run the single-match research pipeline", async () => {
  const restore = setEnv({
    APP_MODE: "research",
    MARKET_DATA_MODE: "replay",
    LIVE_DATA_MODE: "replay",
    JINGCAI_OFFICIAL_FEED_MODE: "file",
    JINGCAI_OFFICIAL_FEED_FILE: "./fixtures/snapshots/latest/jingcai-official-feed.json",
    ODDS_SNAPSHOT_REPLAY_FILE: "./fixtures/snapshots/latest/raw/the-odds-api-h2h.json",
    LIVE_SNAPSHOT_REPLAY_ENABLED: "true",
    LIVE_SNAPSHOT_REPLAY_FILE: "./fixtures/snapshots/latest/live-data.json",
    ENABLE_STAKE_SUGGESTION: "false",
  });

  try {
    const [marketBundle, liveData, providerStatus, pipelineData, report] = await Promise.all([
      getMarketDataBundle(),
      getStaticPageData(),
      getProviderStatus(),
      getPipelineData(),
      buildDataQualityReport(),
    ]);

    assert.equal(marketBundle.mode, "real_snapshot_replay");
    assert.equal(liveData.liveMode, "real_snapshot_replay");
    assert.ok(marketBundle.rawMarketBoard.length > 0);
    assert.ok(liveData.liveMatches.length > 0);
    assert.ok(pipelineData.marketSnapshots.length > 0);
    assert.ok(pipelineData.recommendationSnapshots.length > 0);
    assert.ok(pipelineData.recommendationSettlements.length > 0);
    assert.equal(providerStatus.marketDataMode, "real_snapshot_replay");
    assert.equal(report.researchSafeStatus, "partial_verified_file");
    assert.equal(report.sourceMode.market, "real_snapshot_replay");
    assert.equal(report.sourceMode.live, "real_snapshot_replay");
    assert.equal(report.sourceMode.jingcai, "file");
    assert.ok(report.layerAProfileCounts.lite + report.layerAProfileCounts.full > 0);
  } finally {
    restore();
  }
});
