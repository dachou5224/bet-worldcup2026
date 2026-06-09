import test from "node:test";
import assert from "node:assert/strict";
import { getPipelineData } from "../dashboard-data.js";
import { buildDataQualityReport } from "../data-hub.js";
import { buildApiPayload } from "../services/api-service.js";

test("pipeline exposes persisted recommendation snapshots", async () => {
  const pipeline = await getPipelineData();

  assert.ok(Array.isArray(pipeline.recommendationSnapshots));
  assert.ok(pipeline.recommendationSnapshots.length > 0);
  assert.ok(pipeline.recommendationSnapshots.every((snapshot) => typeof snapshot.snapshotId === "string"));
  assert.ok(pipeline.recommendationSnapshots.every((snapshot) => typeof snapshot.capturedAt === "string"));
  assert.ok(pipeline.recommendationSnapshots.every((snapshot) => typeof snapshot.marketSourceMode === "string"));
  assert.ok(pipeline.recommendationSnapshots.every((snapshot) => typeof snapshot.liveSourceMode === "string"));
  assert.ok(pipeline.recommendationSnapshots.every((snapshot) => typeof snapshot.jingcaiSourceMode === "string"));
  assert.ok(pipeline.recommendationSnapshots.every((snapshot) => snapshot.layerA && snapshot.layerB && snapshot.layerC));
  assert.ok(
    pipeline.recommendationSnapshots.every(
      (snapshot) => snapshot.layerC?.primaryRecommendation?.displaySuggestedStakeUnits == null,
    ),
  );

  const layerCCount = pipeline.recommendationSnapshots.filter(
    (snapshot) => Boolean(snapshot.layerC?.primaryRecommendation),
  ).length;
  assert.equal(pipeline.recommendationSnapshotSummary.snapshotCount, pipeline.recommendationSnapshots.length);
  assert.equal(pipeline.recommendationSnapshotSummary.layerCReadyCount, layerCCount);
});

test("data quality report includes recommendation snapshot summary", async () => {
  const report = await buildDataQualityReport();

  assert.ok(report.recommendationSnapshotSummary);
  assert.ok(report.recommendationSnapshotCount >= 0);
  assert.equal(
    report.recommendationSnapshotSummary.snapshotCount,
    report.recommendationSnapshotCount,
  );
  assert.ok(typeof report.recommendationSnapshotSummary.hasLayerCRecommendation === "boolean");
  assert.equal(typeof report.marketSourceMode, "string");
  assert.equal(typeof report.liveSourceMode, "string");
  assert.equal(typeof report.jingcaiSourceMode, "string");
});

test("api exposes recommendation snapshots", async () => {
  const api = await buildApiPayload();
  const snapshots = await api["/api/data/recommendation-snapshots"]();

  assert.ok(Array.isArray(snapshots));
  assert.ok(snapshots.length > 0);
  assert.ok(snapshots.every((snapshot) => typeof snapshot.textSummary === "string"));
});
