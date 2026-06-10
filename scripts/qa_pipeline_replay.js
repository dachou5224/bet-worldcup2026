import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { getProviderConfig } from "../provider-config.js";

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

async function run() {
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
    await delay(0);
    const [{ buildDataQualityReport }, { getPipelineData, getDashboardData }, { getProviderStatus }] =
      await Promise.all([import("../data-hub.js"), import("../dashboard-data.js"), import("../data-sources.js")]);

    const [report, pipelineData, dashboardData, providerStatus] = await Promise.all([
      buildDataQualityReport(),
      getPipelineData(),
      getDashboardData(),
      getProviderStatus(),
    ]);

    assert.equal(getProviderConfig().marketDataMode, "replay");
    assert.equal(getProviderConfig().liveDataMode, "replay");
    assert.equal(providerStatus.marketDataMode, "real_snapshot_replay");
    assert.equal(dashboardData.liveDataMode, "real_snapshot_replay");
    assert.ok(Array.isArray(pipelineData.rawMarketBoard));
    assert.ok(pipelineData.rawMarketBoard.length > 0);
    assert.ok(Array.isArray(pipelineData.marketSnapshots));
    assert.ok(pipelineData.marketSnapshots.length > 0);
    assert.ok(Array.isArray(pipelineData.recommendationSnapshots));
    assert.ok(pipelineData.recommendationSnapshots.length > 0);
    assert.ok(Array.isArray(pipelineData.recommendationSettlements));
    assert.ok(pipelineData.recommendationSettlements.length > 0);
    assert.equal(report.researchSafeStatus, "partial_verified_file");
    assert.equal(report.sourceMode.market, "real_snapshot_replay");
    assert.equal(report.sourceMode.live, "real_snapshot_replay");
    assert.equal(report.sourceMode.jingcai, "file");
    assert.ok(!report.researchSafeBlockReasons.includes("fallback_used"));
    assert.ok(report.layerAReadyCount > 0);
    assert.ok(report.layerAProfileCounts.lite + report.layerAProfileCounts.full > 0);

    const fallbackDummyCount = pipelineData.tomorrowPredictions.filter(
      (prediction) => prediction.marketBaseline?.calibrationMode === "fallback_dummy",
    ).length;
    assert.equal(fallbackDummyCount, 0, "replay pipeline must not use fallback_dummy calibration");
    assert.equal(dashboardData.analysisItems.length, 0);
    assert.equal(dashboardData.expertOpinions.length, 0);
    assert.ok(pipelineData.tomorrowPredictions.length >= 70, "bookmaker snapshot should cover most fixtures");

    console.log(
      JSON.stringify(
        {
          ok: true,
          checks: [
            "explicit replay mode produces market snapshots",
            "explicit replay mode produces live matches",
            "explicit replay mode produces recommendation snapshots",
            "explicit replay mode produces recommendation settlements",
            "researchSafeStatus=partial_verified_file in jingcai=file scenario",
            "no fallback_dummy calibration in replay predictions",
            "research replay does not inject mock display fields",
            "bookmaker snapshot covers >=70 fixtures",
          ],
        },
        null,
        2,
      ),
    );
  } finally {
    restore();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
