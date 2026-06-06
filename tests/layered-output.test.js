import test from "node:test";
import assert from "node:assert/strict";
import { getDashboardData, getPipelineData } from "../dashboard-data.js";

test("pipeline exposes layered outputs with Layer C text summary", async () => {
  const pipeline = await getPipelineData();

  assert.ok(Array.isArray(pipeline.layeredOutputs));
  assert.ok(pipeline.layeredOutputs.length > 0);

  const layeredOutput = pipeline.layeredOutputs.find((item) => item.layerA?.signalCandidate);
  assert.ok(layeredOutput);
  assert.ok(typeof layeredOutput.textSummary === "string");
  assert.ok(layeredOutput.textSummary.length > 0);
  assert.ok(layeredOutput.layerA.signalCandidate);
  if (layeredOutput.layerC?.primaryRecommendation) {
    assert.equal(layeredOutput.defaultDisplayLayer, "C");
    assert.ok(layeredOutput.layerB.mappingConfidence);
    assert.match(layeredOutput.textSummary, /体彩收敛/);
  }
});

test("dashboard predictions carry layeredOutput for UI consumption", async () => {
  const dashboard = await getDashboardData();

  assert.ok(Array.isArray(dashboard.tomorrowPredictions));
  assert.ok(Array.isArray(dashboard.layeredOutputs));

  const layeredPrediction = dashboard.tomorrowPredictions.find((item) => item.layeredOutput);
  assert.ok(layeredPrediction);
  assert.ok(layeredPrediction.layeredOutput.layerA.signalCandidate);
  assert.ok(typeof layeredPrediction.layeredOutput.textSummary === "string");
  assert.ok(dashboard.layeredOutputs.some((item) => item.fixtureId === layeredPrediction.id));
});
