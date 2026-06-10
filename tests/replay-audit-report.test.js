import assert from "node:assert/strict";
import { test } from "node:test";
import { loadProjectEnv } from "../lib/load-env.js";
import {
  buildReplayAuditRows,
  classifyWatchSubtype,
  summarizeReplayAuditRows,
} from "../lib/replay-audit-report.js";

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

test("buildReplayAuditRows emits eight auditable watch rows", async () => {
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
    loadProjectEnv();
    const [{ buildDataQualityReport }, { getDashboardData }] = await Promise.all([
      import("../data-hub.js"),
      import("../dashboard-data.js"),
    ]);

    const [report, dashboardData] = await Promise.all([buildDataQualityReport(), getDashboardData()]);
    const rows = buildReplayAuditRows({
      tomorrowPredictions: dashboardData.tomorrowPredictions,
      qualityReport: report,
      riskProfile: "strict",
    });
    const summary = summarizeReplayAuditRows(rows);

    assert.equal(rows.length, 8);
    assert.equal(summary.rowCount, 8);
    assert.ok(rows.every((row) => row.WATCH子类型));
    assert.ok(rows.every((row) => row.sourceMode_market && row.sourceMode_live && row.sourceMode_jingcai));
    assert.ok(rows.every((row) => row.riskProfile === "strict"));
    assert.ok(rows.every((row) => row.expressionLevel));
    assert.ok(rows.every((row) => row.expressionReason));
    assert.ok(rows.every((row) => row.maxRiskBudgetHint !== null));
    assert.ok(rows.every((row) => row.strictDecisionCode));
    assert.ok(rows.every((row) => row.balancedDecisionCode));
    assert.ok(rows.every((row) => row.aggressiveDecisionCode));
    assert.ok(rows.every((row) => row.expressionWarnings !== undefined));
    assert.ok(rows.some((row) => row.WATCH子类型.includes("watch_gs_divergence")));
    assert.ok(rows.every((row) => !String(row.watch说明 || "").includes("盘口与预测市场大致同向")));
  } finally {
    restore();
  }
});

test("classifyWatchSubtype preserves positive EV and divergence tags", () => {
  const subtype = classifyWatchSubtype(
    { expectedValue: 0.021, riskTags: [] },
    { directionalAlignment: "divergent" },
    0,
  );

  assert.equal(
    subtype,
    "watch_positive_ev_below_threshold|watch_market_baseline_only|watch_gs_divergence",
  );
});
