import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildMarketBaselineBundle,
  getBaselineOutcomePrice,
} from "../quant/models/market-baseline.js";
import {
  buildSignalCandidatesFromBaseline,
  pickPrimarySignalCandidate,
} from "../quant/recommendation/decision-layer.js";
import { buildMarketSnapshotBundle } from "../quant/normalization/market-snapshot.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadRawMarketBoard() {
  const filePath = path.resolve(__dirname, "../fixtures/raw-market-board.json");
  return JSON.parse(readFileSync(filePath, "utf-8"));
}

test("market-baseline groups fixtures and produces consensus maps", () => {
  const rawMarketBoard = loadRawMarketBoard();
  const snapshotBundle = buildMarketSnapshotBundle(rawMarketBoard);
  const baselineBundle = buildMarketBaselineBundle(snapshotBundle.marketSnapshots);

  assert.equal(baselineBundle.baselines.length, 2);
  assert.equal(baselineBundle.summary.baselineCount, 2);
  assert.ok(baselineBundle.summary.confidenceBuckets.high >= 1);
  assert.ok(typeof baselineBundle.summary.calibrationModeCounts === "object");

  const h2hBaseline = baselineBundle.baselines.find((baseline) => baseline.marketType === "h2h");
  assert.ok(h2hBaseline);
  assert.deepEqual(h2hBaseline.outcomeNames, ["home", "draw", "away"]);
  assert.ok(h2hBaseline.bookmakerConsensus.home > 0);
  assert.ok(h2hBaseline.modelConsensus.home > 0);
  assert.equal(getBaselineOutcomePrice(h2hBaseline, "home"), 2.04);
  assert.equal(typeof h2hBaseline.calibrationMode, "string");
  assert.equal(typeof h2hBaseline.calibrationConfidence, "string");
  assert.equal(h2hBaseline.scoreMatrix.rawMass > 0, true);
  assert.ok(Math.abs(h2hBaseline.scoreMatrix.matrix.flat().reduce((sum, value) => sum + value, 0) - 1) < 1e-9);
});

test("market-baseline feeds SignalCandidate generation", () => {
  const rawMarketBoard = loadRawMarketBoard();
  const snapshotBundle = buildMarketSnapshotBundle(rawMarketBoard);
  const baselineBundle = buildMarketBaselineBundle(snapshotBundle.marketSnapshots);
  const h2hBaseline = baselineBundle.baselines.find((baseline) => baseline.marketType === "h2h");

  const candidates = buildSignalCandidatesFromBaseline(h2hBaseline);
  const primary = pickPrimarySignalCandidate(candidates);

  assert.equal(candidates.length, 3);
  assert.ok(primary);
  assert.equal(typeof primary.decisionCode, "string");
  assert.equal(typeof primary.recommendationLevel, "string");
});
