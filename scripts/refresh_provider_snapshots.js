import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { getPipelineData } from "../dashboard-data.js";
import { getProviderStatus, getSupplementalSignals, getStaticPageData } from "../data-sources.js";
import { buildBacktestRunFromSettlements, writeBacktestRunArtifact } from "../lib/backtest-artifacts.js";
import {
  writeRecommendationSettlementsArtifact,
  writeRecommendationSnapshotsArtifact,
} from "../lib/recommendation-artifacts.js";
import { projectRoot } from "../lib/paths.js";
import { getDashboardData as getDashboardDataBundle } from "../dashboard-data.js";

function writeSnapshot(filePath, payload) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

async function run() {
  const outputDir = path.join(projectRoot, "fixtures", "snapshots");
  const capturedAt = new Date().toISOString();

  const [providerStatus, pipelineData, dashboardData, liveData, supplementalSignals] = await Promise.all([
    getProviderStatus(),
    getPipelineData(),
    getDashboardDataBundle(),
    getStaticPageData(),
    getSupplementalSignals(),
  ]);
  const completedComparisons = dashboardData.completedComparisons;
  const backtestRunArtifact = buildBacktestRunFromSettlements(
    pipelineData.recommendationSettlements || [],
    dashboardData.tomorrowPredictions || [],
    {
      capturedAt,
      sourceMode: "live_derived",
    },
  );

  writeSnapshot(path.join(outputDir, "provider-status.json"), {
    capturedAt,
    providerStatus,
  });
  writeSnapshot(path.join(outputDir, "prediction-pipeline.json"), {
    capturedAt,
    pipelineData,
  });
  writeRecommendationSnapshotsArtifact(
    {
      capturedAt,
      recommendationSnapshots: pipelineData.recommendationSnapshots || [],
      recommendationSnapshotSummary: pipelineData.recommendationSnapshotSummary || null,
    },
    "fixtures/snapshots",
  );
  writeRecommendationSettlementsArtifact(
    {
      capturedAt,
      recommendationSettlements: pipelineData.recommendationSettlements || [],
      recommendationSettlementSummary: pipelineData.recommendationSettlementSummary || null,
    },
    "fixtures/snapshots",
  );
  writeSnapshot(path.join(outputDir, "live-data.json"), {
    capturedAt,
    liveData,
  });
  writeSnapshot(path.join(outputDir, "post-match-review.json"), {
    capturedAt,
    completedComparisons,
    summary: dashboardData.postMatchReviewSummary || null,
  });
  writeSnapshot(path.join(outputDir, "supplemental-signals.json"), {
    capturedAt,
    supplementalSignals,
  });
  if (backtestRunArtifact.backtestRun.length > 0) {
    writeBacktestRunArtifact(
      backtestRunArtifact.backtestRun,
      "backtest-run.json",
      "fixtures/snapshots",
      {
        sourceMode: backtestRunArtifact.sourceMode,
        summary: backtestRunArtifact.summary || null,
      },
    );
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        outputDir,
        files: [
        "provider-status.json",
        "prediction-pipeline.json",
        "recommendation-snapshots.json",
        "recommendation-settlements.json",
        "live-data.json",
        "post-match-review.json",
        "supplemental-signals.json",
        ...(backtestRunArtifact.backtestRun.length > 0 ? ["backtest-run.json"] : []),
      ],
      },
      null,
      2,
    ),
  );
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
