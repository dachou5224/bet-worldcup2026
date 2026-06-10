import {
  writeJsonSnapshot,
  writeSnapshotToTargets,
  writeTextSnapshotToTargets,
  resolveSnapshotDirs,
} from "../lib/snapshot-store.js";
import { loadProjectEnv } from "../lib/load-env.js";
import { getProviderConfig } from "../provider-config.js";
import { generateWatchInterpretation } from "../lib/watch-interpretation.js";
import {
  buildReplayAuditCsv,
  buildReplayAuditRows,
  buildReplayAuditSummaryMarkdown,
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

    const [{ buildDataQualityReport }, { getPipelineData, getDashboardData }] = await Promise.all([
      import("../data-hub.js"),
      import("../dashboard-data.js"),
    ]);

    const [qualityReport, pipelineData, dashboardData] = await Promise.all([
      buildDataQualityReport(),
      getPipelineData(),
      getDashboardData(),
    ]);

    const watchInterpretationMode = process.env.WATCH_INTERPRETATION_MODE || "local";
    const watchCandidates = Array.isArray(pipelineData.signalCandidates)
      ? pipelineData.signalCandidates.filter(
          (candidate) => candidate?.recommendationLevel === "WATCH" && candidate?.watchEdgeBreakdown,
        )
      : [];
    const watchInterpretations = [];
    if (watchCandidates.length) {
      for (const candidate of watchCandidates) {
        watchInterpretations.push({
          fixtureId: candidate.fixtureId ?? null,
          marketType: candidate.marketType ?? null,
          outcome: candidate.outcome ?? null,
          decisionCode: candidate.decisionCode ?? null,
          recommendationLevel: candidate.recommendationLevel ?? null,
          result: await generateWatchInterpretation(candidate, { mode: watchInterpretationMode }),
        });
      }
    }

    const capturedAt = new Date().toISOString();
    const config = getProviderConfig();
    const dirs = resolveSnapshotDirs(capturedAt, "pipeline-replay");
    const auditRows = buildReplayAuditRows({
      tomorrowPredictions: dashboardData.tomorrowPredictions,
      qualityReport,
      watchInterpretations,
      riskProfile: config.recommendationRiskProfile,
    });
    const auditCsv = buildReplayAuditCsv(auditRows);
    const auditSummary = summarizeReplayAuditRows(auditRows);
    const auditSummaryMarkdown = buildReplayAuditSummaryMarkdown({
      capturedAt,
      qualityReport,
      rows: auditRows,
      watchInterpretationMode,
    });
    const result = {
      capturedAt,
      appMode: config.appMode,
      marketDataMode: config.marketDataMode,
      liveDataMode: config.liveDataMode,
      jingcaiOfficialFeedMode: config.jingcaiOfficialFeedMode,
      qualityReport: {
        recommendationRiskProfile: qualityReport.recommendationRiskProfile,
        researchSafe: qualityReport.researchSafe,
        researchSafeStatus: qualityReport.researchSafeStatus,
        researchSafeBlockReasons: qualityReport.researchSafeBlockReasons,
        sourceMode: qualityReport.sourceMode,
        layerAReadiness: qualityReport.layerAReadiness,
        backtestReviewWarning: qualityReport.backtestReviewWarning,
      },
      summary: {
        marketSnapshots: pipelineData.marketSnapshots?.length || 0,
        recommendationSnapshots: pipelineData.recommendationSnapshots?.length || 0,
        recommendationSettlements: pipelineData.recommendationSettlements?.length || 0,
        liveMatches: dashboardData.liveMatches?.length || 0,
        tomorrowPredictions: dashboardData.tomorrowPredictions?.length || 0,
        layerAProfileCounts: qualityReport.layerAProfileCounts || null,
      },
      providerHealth: pipelineData.providerHealth || null,
      marketSnapshotSummary: pipelineData.marketSnapshotSummary || null,
      recommendationSnapshotSummary: pipelineData.recommendationSnapshotSummary || null,
      recommendationSettlementSummary: pipelineData.recommendationSettlementSummary || null,
      postMatchReviewSummary: dashboardData.postMatchReviewSummary || null,
      watchInterpretationMode,
      recommendationRiskProfile: config.recommendationRiskProfile,
      watchInterpretations,
      replayAuditSummary: auditSummary,
      pipelineData: {
        marketSnapshots: pipelineData.marketSnapshots,
        signalCandidates: pipelineData.signalCandidates,
        recommendationSnapshots: pipelineData.recommendationSnapshots,
        recommendationSettlements: pipelineData.recommendationSettlements,
        layeredOutputs: pipelineData.layeredOutputs,
      },
      dashboardData: {
        liveMatches: dashboardData.liveMatches,
        tomorrowPredictions: dashboardData.tomorrowPredictions,
        completedComparisons: dashboardData.completedComparisons,
        jingcaiRecommendations: dashboardData.jingcaiRecommendations,
      },
    };

    writeSnapshotToTargets({
      fileName: "pipeline-replay-result.json",
      payload: result,
      capturedAt,
      dirs,
    });
    writeTextSnapshotToTargets({
      fileName: "replay-8-matches-with-gs.csv",
      contents: auditCsv,
      dirs,
    });
    writeTextSnapshotToTargets({
      fileName: "replay-8-matches-audit.csv",
      contents: auditCsv,
      dirs,
    });
    writeTextSnapshotToTargets({
      fileName: "replay-8-matches-summary.md",
      contents: auditSummaryMarkdown,
      dirs,
    });

    console.log(
      JSON.stringify(
        {
          ok: true,
          capturedAt,
          outputDirs: {
            latest: dirs.latestDir,
            versioned: dirs.versionedDir,
            flat: dirs.flatDir,
          },
          summary: result.summary,
          replayAuditSummary: result.replayAuditSummary,
          qualityReport: result.qualityReport,
          files: [
            "pipeline-replay-result.json",
            "replay-8-matches-with-gs.csv",
            "replay-8-matches-audit.csv",
            "replay-8-matches-summary.md",
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
