import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildSignalCandidate } from "../quant/recommendation/decision-layer.js";
import { buildSignalCandidatesFromMarket, buildTomorrowPredictionsFromMarket } from "../market-pipeline.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadRawMarketBoard() {
  const filePath = path.resolve(__dirname, "../fixtures/raw-market-board.json");
  return JSON.parse(readFileSync(filePath, "utf-8"));
}

test("decision-layer follows the documented gate ordering", () => {
  const badData = buildSignalCandidate({
    fixtureId: 1,
    marketType: "h2h",
    outcome: "home",
    offeredOdds: null,
    marketProbability: 0.45,
    modelProbability: 0.5,
  });
  assert.equal(badData.decisionCode, "skip_bad_data");
  assert.equal(badData.recommendationLevel, "NO_ACTION");

  const unmapped = buildSignalCandidate({
    fixtureId: 1,
    marketType: "qualification",
    outcome: "home",
    offeredOdds: 2.1,
    marketProbability: 0.45,
    modelProbability: 0.55,
    playMappable: false,
  });
  assert.equal(unmapped.decisionCode, "skip_unmapped_play");
  assert.equal(unmapped.recommendationLevel, "NO_ACTION");

  const noEdge = buildSignalCandidate({
    fixtureId: 1,
    marketType: "h2h",
    outcome: "home",
    offeredOdds: 2.1,
    marketProbability: 0.5,
    modelProbability: 0.4,
    alpha: 0.4,
  });
  assert.equal(noEdge.decisionCode, "skip_no_adjusted_edge");
  assert.equal(noEdge.recommendationLevel, "NO_ACTION");

  const watchEv = buildSignalCandidate({
    fixtureId: 1,
    marketType: "h2h",
    outcome: "home",
    offeredOdds: 2.1,
    marketProbability: 0.45,
    modelProbability: 0.5,
    alpha: 0.4,
    evThreshold: 0.02,
  });
  assert.equal(watchEv.decisionCode, "watch_ev_too_low");
  assert.equal(watchEv.recommendationLevel, "WATCH");

  const negativeKelly = buildSignalCandidate({
    fixtureId: 1,
    marketType: "h2h",
    outcome: "home",
    offeredOdds: 1.7,
    marketProbability: 0.5,
    modelProbability: 0.54,
    alpha: 0.4,
    evThreshold: -0.2,
  });
  assert.equal(negativeKelly.decisionCode, "skip_negative_kelly");
  assert.equal(negativeKelly.recommendationLevel, "NO_ACTION");

  const smallStake = buildSignalCandidate({
    fixtureId: 1,
    marketType: "h2h",
    outcome: "home",
    offeredOdds: 2.2,
    marketProbability: 0.45,
    modelProbability: 0.5,
    alpha: 0.4,
    evThreshold: 0.02,
    minStakeFraction: 0.01,
  });
  assert.equal(smallStake.decisionCode, "watch_stake_too_small");
  assert.equal(smallStake.recommendationLevel, "WATCH");

  const riskCap = buildSignalCandidate({
    fixtureId: 1,
    marketType: "h2h",
    outcome: "home",
    offeredOdds: 3.0,
    marketProbability: 0.37,
    modelProbability: 0.5,
    alpha: 0.4,
    evThreshold: 0.02,
    caps: { singleCap: 0, fixtureCapRemain: 0, dayCapRemain: 0, factorCapRemain: 0 },
  });
  assert.equal(riskCap.decisionCode, "skip_risk_cap");
  assert.equal(riskCap.recommendationLevel, "NO_ACTION");
});

test("decision-layer maps positive signals to candidate levels", () => {
  const smallPosition = buildSignalCandidate({
    fixtureId: 1,
    marketType: "h2h",
    outcome: "home",
    offeredOdds: 3.0,
    marketProbability: 0.37,
    modelProbability: 0.5,
    alpha: 0.4,
    evThreshold: 0.02,
    minActionStake: 0.01,
  });

  assert.equal(smallPosition.decisionCode, "candidate_positive_ev");
  assert.equal(smallPosition.recommendationLevel, "SMALL_POSITION");
  assert.match(smallPosition.recommendationText, /市场定价/);
  assert.match(smallPosition.recommendationText, /决策结果/);

  const lowConfidence = buildSignalCandidate({
    fixtureId: 1,
    marketType: "h2h",
    outcome: "home",
    offeredOdds: 3.0,
    marketProbability: 0.37,
    modelProbability: 0.5,
    alpha: 0.4,
    evThreshold: 0.02,
    confidence: "low",
  });

  assert.equal(lowConfidence.decisionCode, "candidate_positive_ev");
  assert.equal(lowConfidence.recommendationLevel, "WATCH");
});

test("market-pipeline exposes signal candidates alongside the current dashboard shape", () => {
  const rawMarketBoard = loadRawMarketBoard();
  const signalCandidates = buildSignalCandidatesFromMarket(rawMarketBoard);
  const predictions = buildTomorrowPredictionsFromMarket(rawMarketBoard);

  assert.ok(signalCandidates.length > 0);
  assert.ok(predictions.length > 0);
  assert.ok(predictions.every((prediction) => Array.isArray(prediction.signalCandidates)));
  assert.ok(predictions.every((prediction) => prediction.signalCandidate));
  assert.ok(
    predictions.every(
      (prediction) =>
        typeof prediction.marketHome === "number" &&
        typeof prediction.modelHome === "number" &&
        typeof prediction.signalCandidate.decisionCode === "string",
    ),
  );
});
