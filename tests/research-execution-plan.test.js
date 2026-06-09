import test from "node:test";
import assert from "node:assert/strict";
import { buildApiPayload } from "../services/api-service.js";
import { buildDataQualityReport } from "../data-hub.js";
import { buildResearchExecutionPlan } from "../lib/research-execution-plan.js";

test("buildResearchExecutionPlan splits A/B tasks from a partial research report", () => {
  const plan = buildResearchExecutionPlan({
    researchSafe: false,
    researchSafeStatus: "blocked",
    sourceMode: {
      market: "real",
      live: "real_fallback_mock",
      jingcai: "fixture",
    },
    layerAProfileCounts: {
      full: 0,
      lite: 0,
      blocked: 5,
    },
    layerAReadyCount: 0,
    recommendationSnapshotCount: 5,
    recommendationSettlementCount: 5,
    postMatchReviewCount: 5,
    backtestReviewWarning: null,
  });

  assert.equal(plan.summary.researchSafeStatus, "blocked");
  assert.equal(plan.agentA.owner, "A");
  assert.ok(Array.isArray(plan.agentA.nextActions));
  assert.ok(plan.agentA.nextActions.some((task) => task.id === "A-KEEP-LAYER-A-SEMANTICS"));
  assert.equal(plan.agentB.owner, "B");
  assert.ok(Array.isArray(plan.agentB.tasks));
  assert.ok(plan.agentB.tasks.some((task) => task.id === "B-LIVE-REAL"));
  assert.ok(plan.agentB.tasks.some((task) => task.id === "B-JINGCAI-REAL"));
  assert.ok(plan.interfaceContract.requiredSnapshots.some((item) => item.file.endsWith("live-data.json")));
  assert.ok(
    plan.interfaceContract.aConsumedFields.includes("quality-report.researchSafeBlockReasons"),
  );
});

test("api exposes research execution plan", async () => {
  const api = await buildApiPayload();
  const plan = await api["/api/data/research-execution-plan"]();
  const report = await buildDataQualityReport();

  assert.equal(plan.summary.researchSafeStatus, report.researchSafeStatus);
  assert.equal(plan.summary.researchSafe, report.researchSafe);
  assert.ok(Array.isArray(plan.agentA.nextActions));
  assert.ok(Array.isArray(plan.agentB.tasks));
  assert.ok(Array.isArray(plan.interfaceContract.requiredSnapshots));
  assert.ok(plan.interfaceContract.requiredSnapshots.length >= 4);
});
