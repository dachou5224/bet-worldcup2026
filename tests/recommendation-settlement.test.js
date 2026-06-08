import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { getPipelineData } from "../dashboard-data.js";
import { buildDataQualityReport } from "../data-hub.js";
import { buildApiPayload } from "../services/api-service.js";
import {
  readRecommendationSettlementSummaryArtifact,
  writeRecommendationSettlementsArtifact,
} from "../lib/recommendation-artifacts.js";

test("pipeline exposes recommendation settlements", async () => {
  const pipeline = await getPipelineData();

  assert.ok(Array.isArray(pipeline.recommendationSettlements));
  assert.ok(pipeline.recommendationSettlements.length > 0);
  assert.ok(
    pipeline.recommendationSettlements.every((entry) => typeof entry.snapshotId === "string"),
  );
  assert.ok(
    pipeline.recommendationSettlements.every((entry) => typeof entry.settlementStatus === "string"),
  );
  assert.ok(
    pipeline.recommendationSettlements.every((entry) => "preMatchSnapshot" in entry),
  );

  const settledCount = pipeline.recommendationSettlements.filter(
    (entry) => entry.settlementStatus === "settled",
  ).length;
  assert.equal(pipeline.recommendationSettlementSummary.snapshotCount, pipeline.recommendationSettlements.length);
  assert.equal(pipeline.recommendationSettlementSummary.settledCount, settledCount);
  assert.equal(typeof pipeline.recommendationSettlementSummary.liveCoverageRate, "number");
  assert.equal(typeof pipeline.recommendationSettlementSummary.liveMatchCoverageRate, "number");
  assert.equal(typeof pipeline.recommendationSettlementSummary.officialMatchCoverageRate, "number");
  assert.equal(typeof pipeline.recommendationSettlementSummary.officialSettlementCoverageRate, "number");
  assert.equal(typeof pipeline.recommendationSettlementSummary.liveDerivedCount, "number");
  assert.equal(typeof pipeline.recommendationSettlementSummary.artifactBackedCount, "number");
  assert.equal(typeof pipeline.recommendationSettlementSummary.liveMatchAlignedCount, "number");
  assert.equal(typeof pipeline.recommendationSettlementSummary.officialMatchAlignedCount, "number");
});

test("data quality report includes recommendation settlement summary", async () => {
  const report = await buildDataQualityReport();

  assert.ok(report.recommendationSettlementSummary);
  assert.ok(report.recommendationSettlementCount >= 0);
  assert.equal(
    report.recommendationSettlementSummary.snapshotCount,
    report.recommendationSettlementCount,
  );
  assert.ok(typeof report.recommendationSettlementSummary.totalRealizedReturnOfficial === "number");
  assert.equal(typeof report.recommendationSettlementSummary.liveCoverageRate, "number");
  assert.equal(typeof report.recommendationSettlementSummary.liveMatchCoverageRate, "number");
  assert.equal(typeof report.recommendationSettlementSummary.officialMatchCoverageRate, "number");
  assert.equal(typeof report.recommendationSettlementSummary.officialSettlementCoverageRate, "number");
});

test("api exposes recommendation settlements", async () => {
  const api = await buildApiPayload();
  const settlements = await api["/api/data/recommendation-settlements"]();

  assert.ok(Array.isArray(settlements));
  assert.ok(settlements.length > 0);
  assert.ok(settlements.every((entry) => typeof entry.settlementStatus === "string"));
});

test("recommendation settlements artifact preserves coverage summary", () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "guess-worldcup-settlement-artifact-"));

  try {
    writeRecommendationSettlementsArtifact(
      {
        capturedAt: "2026-06-08T00:00:00.000Z",
        recommendationSettlements: [
          {
            snapshotId: "1::2026-06-08T00:00:00Z",
            settlementStatus: "settled",
            settlementSourceMode: "live_official",
            liveMatchAligned: true,
            officialMatchAligned: true,
            officialSettlementComplete: true,
          },
        ],
        recommendationSettlementSummary: {
          snapshotCount: 1,
          settledCount: 1,
          pendingCount: 0,
          noRecommendationCount: 0,
          liveDerivedCount: 1,
          artifactBackedCount: 0,
          liveMatchAlignedCount: 1,
          officialMatchAlignedCount: 1,
          officialSettlementCompleteCount: 1,
          liveCoverageRate: 1,
          liveMatchCoverageRate: 1,
          officialMatchCoverageRate: 1,
          officialSettlementCoverageRate: 1,
          totalRealizedReturnOfficial: 2,
          meanBrier: 0.1,
          meanLogLoss: 0.2,
          meanClv: 0.3,
        },
      },
      tempDir,
    );

    const summary = readRecommendationSettlementSummaryArtifact(tempDir);
    assert.equal(summary.snapshotCount, 1);
    assert.equal(summary.liveMatchCoverageRate, 1);
    assert.equal(summary.officialMatchCoverageRate, 1);
    assert.equal(summary.officialSettlementCoverageRate, 1);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
