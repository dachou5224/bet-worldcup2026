import test from "node:test";
import assert from "node:assert/strict";
import {
  decimalOddsToRawProbabilities,
  fairOdds,
  margin,
  proportionalDevig,
} from "../quant/odds/devig.js";

test("decimalOddsToRawProbabilities supports arbitrary outcomes", () => {
  const outcomes = decimalOddsToRawProbabilities([
    { name: "home", decimalOdds: 2.4 },
    { name: "draw", decimalOdds: 3.2 },
    { name: "away", decimalOdds: 3.0 },
  ]);

  assert.equal(outcomes.length, 3);
  assert.equal(outcomes[0].rawProbability, 1 / 2.4);
});

test("margin computes overround from arbitrary outcomes", () => {
  const overround = margin([2.4, 3.2, 3.0]);
  assert.ok(overround > 0);
  assert.ok(overround < 0.1);
});

test("proportionalDevig returns normalized fair probabilities", () => {
  const outcomes = proportionalDevig([2.4, 3.2, 3.0]);
  const total = outcomes.reduce((sum, outcome) => sum + outcome.fairProbability, 0);
  assert.ok(Math.abs(total - 1) < 1e-12);
});

test("fairOdds returns reciprocal odds from fair probabilities", () => {
  const outcomes = fairOdds([2.4, 3.2, 3.0]);
  assert.equal(outcomes.length, 3);
  assert.ok(outcomes.every((outcome) => outcome.fairOdds > 1));
});
