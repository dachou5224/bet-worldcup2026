import assert from "node:assert/strict";
import { test } from "node:test";
import { buildRecommendationRiskProfileEvaluation, normalizeRecommendationRiskProfile } from "../lib/recommendation-risk-profile.js";

test("normalizeRecommendationRiskProfile defaults to strict", () => {
  assert.equal(normalizeRecommendationRiskProfile(), "strict");
  assert.equal(normalizeRecommendationRiskProfile("balanced"), "balanced");
  assert.equal(normalizeRecommendationRiskProfile("unknown"), "strict");
});

test("risk profile evaluation separates strict, balanced and aggressive expressions", () => {
  const balancedCandidate = {
    recommendationLevel: "WATCH",
    decisionCode: "watch_ev_too_low",
    expectedValue: 0.0263,
    adjustedProbability: 0.1974,
    marketProbability: 0.1956,
    offeredOdds: 5.09,
    edge: 0.0017,
    riskTags: [],
  };

  const aggressiveCandidate = {
    recommendationLevel: "WATCH",
    decisionCode: "watch_ev_too_low",
    expectedValue: -0.014,
    adjustedProbability: 0.322,
    marketProbability: 0.308,
    offeredOdds: 4.2,
    edge: 0.014,
    riskTags: [],
  };

  const strict = buildRecommendationRiskProfileEvaluation(balancedCandidate, {
    riskProfile: "strict",
    gsConsistency: "aligned",
    predictionMarketCount: 1,
  });
  const balanced = buildRecommendationRiskProfileEvaluation(balancedCandidate, {
    riskProfile: "balanced",
    gsConsistency: "aligned",
    predictionMarketCount: 1,
  });
  const aggressive = buildRecommendationRiskProfileEvaluation(aggressiveCandidate, {
    riskProfile: "aggressive",
    gsConsistency: "divergent",
    predictionMarketCount: 0,
  });
  const strictCandidate = buildRecommendationRiskProfileEvaluation(
    {
      recommendationLevel: "SMALL_POSITION",
      decisionCode: "candidate_positive_ev",
      expectedValue: 0.052,
      adjustedProbability: 0.41,
      marketProbability: 0.37,
      offeredOdds: 2.7,
      edge: 0.04,
      riskTags: [],
    },
    {
      riskProfile: "strict",
      gsConsistency: "aligned",
      predictionMarketCount: 1,
    },
  );

  assert.equal(strict.expressionLevel, "OBSERVE_ONLY");
  assert.equal(strict.strictDecisionCode, "watch_ev_too_low");
  assert.equal(strict.balancedExpressionLevel, "LEAN");
  assert.equal(strict.aggressiveExpressionLevel, "SPECULATIVE_LEAN");

  assert.equal(balanced.expressionLevel, "LEAN");
  assert.ok(balanced.expressionReason.includes("正 EV"));
  assert.ok(balanced.expressionWarnings.length > 0);

  assert.equal(aggressive.expressionLevel, "SPECULATIVE_LEAN");
  assert.ok(aggressive.expressionReason.includes("GS"));
  assert.ok(aggressive.expressionWarnings.length > 0);

  assert.equal(strictCandidate.expressionLevel, "MICRO_EXPRESSION");
  assert.equal(strictCandidate.strictDecisionCode, "strict_candidate");
});
