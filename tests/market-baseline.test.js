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
  const h2hPricingMap = Object.fromEntries(
    h2hBaseline.pricing.outcomes.map((outcome) => [outcome.name, outcome.probability]),
  );
  assert.ok(Math.abs(h2hBaseline.modelConsensus.home - h2hPricingMap.home) < 1e-12);
  assert.ok(Math.abs(h2hBaseline.modelConsensus.draw - h2hPricingMap.draw) < 1e-12);
  assert.ok(Math.abs(h2hBaseline.modelConsensus.away - h2hPricingMap.away) < 1e-12);
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

test("market-baseline matches replay snapshots even when fixtureId is string", () => {
  const marketSnapshots = [
    {
      fixtureId: "8287",
      fixture: "墨西哥 vs 南非",
      marketType: "h2h",
      period: "full_time",
      line: null,
      capturedAt: "2026-06-09T00:00:00.000Z",
      outcomes: [
        { name: "home", price: 1.44, probability: 0.67, fairProbability: 0.67 },
        { name: "draw", price: 4.5, probability: 0.22, fairProbability: 0.22 },
        { name: "away", price: 8.9, probability: 0.11, fairProbability: 0.11 },
      ],
      sourceMeta: { marketNature: "bookmaker", directEVEligible: true },
    },
  ];

  const baselineBundle = buildMarketBaselineBundle(marketSnapshots);
  const baseline = baselineBundle.baselines[0];

  assert.ok(baseline);
  assert.equal(baseline.fixtureId, "8287");
  assert.ok(baseline.primarySnapshot);
  assert.ok(baseline.bookmakerSnapshots.length > 0);
  assert.ok(baseline.dataOk);
  assert.deepEqual(baseline.outcomeNames, ["home", "draw", "away"]);
  const candidates = buildSignalCandidatesFromBaseline(baseline);
  assert.equal(candidates.length, 3);
  assert.ok(candidates.some((candidate) => candidate.decisionCode !== "skip_bad_data"));
});

test("market-baseline prefers bookmaker snapshots as primary snapshot when prediction data exists", () => {
  const marketSnapshots = [
    {
      fixtureId: "1001",
      fixture: "A vs B",
      marketType: "h2h",
      period: "full_time",
      line: null,
      capturedAt: "2026-06-09T00:00:00.000Z",
      outcomes: [
        { name: "home", price: 1.8, probability: 0.5, fairProbability: 0.5 },
        { name: "draw", price: 3.2, probability: 0.25, fairProbability: 0.25 },
        { name: "away", price: 4.1, probability: 0.25, fairProbability: 0.25 },
      ],
      sourceMeta: { marketNature: "bookmaker", directEVEligible: true },
    },
    {
      fixtureId: "1001",
      fixture: "A vs B",
      marketType: "h2h",
      period: "full_time",
      line: null,
      capturedAt: "2026-06-09T01:00:00.000Z",
      outcomes: [
        { name: "home", price: null, probability: 0.52, fairProbability: null },
        { name: "draw", price: null, probability: 0.23, fairProbability: null },
        { name: "away", price: null, probability: 0.25, fairProbability: null },
      ],
      sourceMeta: { marketNature: "prediction_market", directEVEligible: false },
    },
  ];

  const baselineBundle = buildMarketBaselineBundle(marketSnapshots);
  const baseline = baselineBundle.baselines[0];

  assert.ok(baseline);
  assert.equal(baseline.primarySnapshot.sourceMeta.marketNature, "bookmaker");
  assert.equal(baseline.primarySnapshot.outcomes[0].price, 1.8);
  const candidates = buildSignalCandidatesFromBaseline(baseline);
  assert.equal(candidates.length, 3);
  assert.ok(candidates.every((candidate) => candidate.decisionCode !== "skip_bad_data"));
});

test("market-baseline skips dummy calibration when only prediction market data exists", () => {
  const marketSnapshots = [
    {
      fixtureId: "2001",
      fixture: "C vs D",
      marketType: "h2h",
      period: "full_time",
      line: null,
      capturedAt: "2026-06-09T01:00:00.000Z",
      outcomes: [
        { name: "home", price: null, probability: 0.52, fairProbability: null },
        { name: "draw", price: null, probability: 0.23, fairProbability: null },
        { name: "away", price: null, probability: 0.25, fairProbability: null },
      ],
      sourceMeta: { marketNature: "prediction_market", directEVEligible: false },
    },
  ];

  const baselineBundle = buildMarketBaselineBundle(marketSnapshots);
  const baseline = baselineBundle.baselines[0];

  assert.ok(baseline);
  assert.equal(baseline.calibrationMode, "skipped_no_bookmaker");
  assert.equal(baseline.dataOk, false);
  assert.ok(baseline.riskTags.includes("bookmaker_missing"));
  assert.equal(baseline.scoreMatrix, null);
  assert.equal(baseline.modelConsensus.home, undefined);

  const candidates = buildSignalCandidatesFromBaseline(baseline);
  assert.ok(candidates.every((candidate) => candidate.decisionCode === "skip_bad_data"));
});

test("market snapshot normalizes h2h outcomes to canonical keys", () => {
  const rawMarketBoard = loadRawMarketBoard();
  const snapshotBundle = buildMarketSnapshotBundle(rawMarketBoard);
  const h2hSnapshots = snapshotBundle.marketSnapshots.filter((snapshot) => snapshot.marketType === "h2h");

  assert.ok(h2hSnapshots.length > 0);
  const sample = h2hSnapshots[0];
  assert.deepEqual(sample.outcomes.map((outcome) => outcome.name), ["home", "draw", "away"]);
  assert.deepEqual(sample.outcomes.map((outcome) => outcome.displayName), [null, null, null]);
});
