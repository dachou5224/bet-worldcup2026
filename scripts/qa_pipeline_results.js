import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { loadProjectEnv } from "../lib/load-env.js";
import { projectRoot } from "../lib/paths.js";
import {
  buildReplayAuditRows,
  summarizeReplayAuditRows,
  validateReplayAuditRows,
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

function readText(filePath) {
  return fs.readFileSync(filePath, "utf-8");
}

function readCsvHeader(csvText) {
  return csvText.split(/\r?\n/)[0].split(",");
}

function readCsvRowCount(csvText) {
  return csvText.split(/\r?\n/).filter((line, index) => index > 0 && line.trim()).length;
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
    loadProjectEnv();
    const [{ buildDataQualityReport }, { getDashboardData }] = await Promise.all([
      import("../data-hub.js"),
      import("../dashboard-data.js"),
    ]);

    const [report, dashboardData] = await Promise.all([buildDataQualityReport(), getDashboardData()]);
    const rows = buildReplayAuditRows({
      tomorrowPredictions: dashboardData.tomorrowPredictions,
      qualityReport: report,
      riskProfile: report.recommendationRiskProfile,
    });
    const summary = summarizeReplayAuditRows(rows);
    const validation = validateReplayAuditRows(rows);

    const latestDir = path.join(projectRoot, "fixtures", "snapshots", "latest");
    const csvPath = path.join(latestDir, "replay-8-matches-audit.csv");
    const legacyCsvPath = path.join(latestDir, "replay-8-matches-with-gs.csv");
    const summaryPath = path.join(latestDir, "replay-8-matches-summary.md");

    assert.ok(fs.existsSync(csvPath), "missing replay-8-matches-audit.csv");
    assert.ok(fs.existsSync(legacyCsvPath), "missing replay-8-matches-with-gs.csv");
    assert.ok(fs.existsSync(summaryPath), "missing replay-8-matches-summary.md");

    const csvText = readText(csvPath);
    const header = readCsvHeader(csvText);
    const rowCount = readCsvRowCount(csvText);
    const requiredColumns = [
      "比赛ID",
      "比赛",
      "sourceMode_market",
      "sourceMode_live",
      "sourceMode_jingcai",
      "researchSafeStatus",
      "riskProfile",
      "calibrationMode",
      "calibrationConfidence",
      "关注方向",
      "关注方向EV",
      "expressionLevel",
      "expressionReason",
      "expressionWarnings",
      "maxRiskBudgetHint",
      "strictExpressionLevel",
      "strictDecisionCode",
      "balancedExpressionLevel",
      "balancedDecisionCode",
      "aggressiveExpressionLevel",
      "aggressiveDecisionCode",
      "WATCH子类型",
      "watch说明",
      "officialPlayType",
      "officialSelection",
      "officialOdds",
      "officialEV",
      "GS_prior_mode",
      "GS_prior_probability_home",
      "GS_prior_probability_draw",
      "GS_prior_probability_away",
      "GS预测结果",
      "GS市场方向",
      "GS一致性",
      "GS比分",
    ];

    for (const column of requiredColumns) {
      assert.ok(header.includes(column), `missing CSV column: ${column}`);
    }

    assert.equal(rowCount, 8, "replay audit csv must contain 8 rows");
    assert.equal(summary.rowCount, 8, "audit summary must contain 8 rows");
    assert.equal(validation.ok, true, `audit validation failed: ${JSON.stringify(validation.anomalies)}`);
    assert.equal(summary.watchSubtypeFlags.watch_market_baseline_only >= 1, true);
    assert.equal(summary.gsConsistencyCounts.aligned + summary.gsConsistencyCounts.divergent, 8);
    assert.ok(((summary.expressionLevelCounts.OBSERVE_ONLY || 0) + (summary.expressionLevelCounts.NO_EXPRESSION || 0)) >= 1);
    assert.ok(header.includes("riskProfile"));
    assert.ok(header.includes("expressionLevel"));
    assert.ok(header.includes("expressionReason"));
    assert.ok(header.includes("expressionWarnings"));
    assert.ok(header.includes("maxRiskBudgetHint"));
    assert.ok(header.includes("strictDecisionCode"));
    assert.ok(header.includes("balancedDecisionCode"));
    assert.ok(header.includes("aggressiveDecisionCode"));
    assert.ok(
      !csvText.includes("参考仓位") && !csvText.includes("注×2"),
      "replay audit csv must not expose stake amounts when ENABLE_STAKE_SUGGESTION=false",
    );
    assert.ok(!csvText.includes("盘口与预测市场大致同向"), "watch explanation must not claim prediction alignment");
    assert.ok(readText(summaryPath).includes("WATCH 子类型分布"), "summary markdown missing key section");
    assert.ok(readText(summaryPath).includes("expressionLevel 分布"), "summary markdown missing expression distribution");

    console.log(
      JSON.stringify(
        {
          ok: true,
          rowCount,
          watchSubtypeCounts: summary.watchSubtypeCounts,
          expressionLevelCounts: summary.expressionLevelCounts,
          gsConsistencyCounts: summary.gsConsistencyCounts,
          files: [csvPath, legacyCsvPath, summaryPath],
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
