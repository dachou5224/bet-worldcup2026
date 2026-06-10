function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeRiskProfile(value) {
  const normalized = String(value || "strict").toLowerCase();
  return ["strict", "balanced", "aggressive"].includes(normalized) ? normalized : "strict";
}

function toWatchContext(signalCandidate = {}, context = {}) {
  return {
    recommendationLevel: signalCandidate.recommendationLevel || "NO_ACTION",
    decisionCode: signalCandidate.decisionCode || "unknown",
    expectedValue: isFiniteNumber(signalCandidate.expectedValue) ? signalCandidate.expectedValue : null,
    adjustedProbability: isFiniteNumber(signalCandidate.adjustedProbability)
      ? signalCandidate.adjustedProbability
      : null,
    marketProbability: isFiniteNumber(signalCandidate.marketProbability) ? signalCandidate.marketProbability : null,
    offeredOdds: isFiniteNumber(signalCandidate.offeredOdds) ? signalCandidate.offeredOdds : null,
    edge: isFiniteNumber(signalCandidate.edge) ? signalCandidate.edge : null,
    gsConsistency: context.gsConsistency || "unknown",
    predictionMarketCount: Number(context.predictionMarketCount || 0),
    hasPredictionMarket: Number(context.predictionMarketCount || 0) > 0,
    riskTags: Array.isArray(signalCandidate.riskTags) ? signalCandidate.riskTags : [],
  };
}

function formatBudgetHint(expressionLevel) {
  if (expressionLevel === "LEAN") {
    return "<=0.1% bankroll";
  }

  if (expressionLevel === "SPECULATIVE_LEAN") {
    return "<=0.25% bankroll";
  }

  if (expressionLevel === "MICRO_EXPRESSION") {
    return "<=0.1% bankroll";
  }

  return "0";
}

function profileDecision({
  profile,
  expressionLevel,
  decisionCode,
  expressionReason,
  expressionWarnings,
}) {
  return {
    profile,
    expressionLevel,
    decisionCode,
    expressionReason,
    expressionWarnings,
    maxRiskBudgetHint: formatBudgetHint(expressionLevel),
  };
}

function buildStrictProfile(signalCandidate, context) {
  const watchContext = toWatchContext(signalCandidate, context);
  const isStrictAction =
    watchContext.recommendationLevel === "CANDIDATE" || watchContext.recommendationLevel === "SMALL_POSITION";

  if (isStrictAction) {
    return profileDecision({
      profile: "strict",
      expressionLevel: "MICRO_EXPRESSION",
      decisionCode: "strict_candidate",
      expressionReason: "严格 profile 已通过现有 gate，可给出极低风险表达。",
      expressionWarnings: ["严格推荐仍由现有 gate 控制。"],
    });
  }

  if (watchContext.recommendationLevel === "WATCH") {
    return profileDecision({
      profile: "strict",
      expressionLevel: "OBSERVE_ONLY",
      decisionCode: watchContext.decisionCode || "strict_observe_only",
      expressionReason: "严格 profile 下仅保留观察位，不构成正式推荐。",
      expressionWarnings: [
        watchContext.hasPredictionMarket
          ? "严格推荐仍由现有 gate 控制；当前结论仅供观察。"
          : "严格推荐仍由现有 gate 控制；当前样本缺少单场预测市场，仅供观察。",
      ],
    });
  }

  return profileDecision({
    profile: "strict",
    expressionLevel: "NO_EXPRESSION",
    decisionCode: watchContext.decisionCode || "strict_no_expression",
    expressionReason: "严格 profile 未放行，保持空表达。",
    expressionWarnings: ["严格推荐仍由现有 gate 控制。"],
  });
}

function buildBalancedProfile(signalCandidate, context) {
  const watchContext = toWatchContext(signalCandidate, context);
  const positiveEV = isFiniteNumber(watchContext.expectedValue) && watchContext.expectedValue > 0;
  const lowPositiveEV = positiveEV && watchContext.expectedValue <= 0.03;
  const positiveEdge = isFiniteNumber(watchContext.edge) && watchContext.edge > 0;
  const gsAligned = watchContext.gsConsistency === "aligned";
  const strictAction =
    watchContext.recommendationLevel === "CANDIDATE" || watchContext.recommendationLevel === "SMALL_POSITION";

  if (strictAction) {
    return profileDecision({
      profile: "balanced",
      expressionLevel: "MICRO_EXPRESSION",
      decisionCode: "balanced_candidate",
      expressionReason: "严格 gate 已放行，可给出极低风险表达。",
      expressionWarnings: ["严格推荐仍由现有 gate 控制。"],
    });
  }

  if (lowPositiveEV || (gsAligned && positiveEdge)) {
    return profileDecision({
      profile: "balanced",
      expressionLevel: "LEAN",
      decisionCode: lowPositiveEV ? "balanced_positive_ev_below_threshold" : "balanced_gs_aligned_lean",
      expressionReason: watchContext.hasPredictionMarket
        ? "正 EV 仍未超过严格安全边际，但可作为探索候选。"
        : "正 EV 仍未超过严格安全边际，且当前缺少单场预测市场，仅能作为探索候选。",
      expressionWarnings: [
        "正 EV 未超过严格安全边际，不构成严格推荐。",
        "金额化输出默认关闭，仅展示风险预算区间。",
      ],
    });
  }

  return profileDecision({
    profile: "balanced",
    expressionLevel: "OBSERVE_ONLY",
    decisionCode: "balanced_observe_only",
    expressionReason: "当前样本缺少足够边际，保持观察。",
    expressionWarnings: ["严格推荐仍由现有 gate 控制。"],
  });
}

function buildAggressiveProfile(signalCandidate, context) {
  const watchContext = toWatchContext(signalCandidate, context);
  const strictAction =
    watchContext.recommendationLevel === "CANDIDATE" || watchContext.recommendationLevel === "SMALL_POSITION";
  const slightNegativeEV = isFiniteNumber(watchContext.expectedValue) && watchContext.expectedValue < 0 && watchContext.expectedValue >= -0.03;
  const highOdds = isFiniteNumber(watchContext.offeredOdds) && watchContext.offeredOdds >= 4;
  const positiveEdge = isFiniteNumber(watchContext.edge) && watchContext.edge > 0;
  const gsDivergent = watchContext.gsConsistency === "divergent";

  if (strictAction) {
    return profileDecision({
      profile: "aggressive",
      expressionLevel: "MICRO_EXPRESSION",
      decisionCode: "aggressive_candidate",
      expressionReason: "严格 gate 已放行，可给出极低风险表达。",
      expressionWarnings: ["严格推荐仍由现有 gate 控制。"],
    });
  }

  if (gsDivergent || (slightNegativeEV && (highOdds || positiveEdge))) {
    return profileDecision({
      profile: "aggressive",
      expressionLevel: "SPECULATIVE_LEAN",
      decisionCode: gsDivergent
        ? "aggressive_gs_divergence_exploration"
        : "aggressive_negative_ev_exploration",
      expressionReason: gsDivergent
        ? "GS 与市场方向分歧，具备反市场探索价值。"
        : "轻微负 EV 但赔率/边际尚可，适合高风险偏好下的小额探索。",
      expressionWarnings: [
        "该方向不是正期望强信号，仅适合高风险偏好下的极小额探索，不应与严格推荐混淆。",
        "金额化输出默认关闭，仅展示风险预算区间。",
      ],
    });
  }

  if (highOdds && positiveEdge) {
    return profileDecision({
      profile: "aggressive",
      expressionLevel: "SPECULATIVE_LEAN",
      decisionCode: "aggressive_high_odds_exploration",
      expressionReason: "高赔率方向具备一定探索价值，但不构成严格推荐。",
      expressionWarnings: [
        "该方向不是正期望强信号，仅适合高风险偏好下的极小额探索，不应与严格推荐混淆。",
        "金额化输出默认关闭，仅展示风险预算区间。",
      ],
    });
  }

  return profileDecision({
    profile: "aggressive",
    expressionLevel: "OBSERVE_ONLY",
    decisionCode: "aggressive_observe_only",
    expressionReason: "当前样本没有形成可接受的探索价值，继续观察。",
    expressionWarnings: ["严格推荐仍由现有 gate 控制。"],
  });
}

export function buildRecommendationRiskProfileEvaluation(signalCandidate, options = {}) {
  const riskProfile = normalizeRiskProfile(options.riskProfile);
  const context = {
    gsConsistency: options.gsConsistency || "unknown",
    predictionMarketCount: options.predictionMarketCount ?? 0,
  };

  const profiles = {
    strict: buildStrictProfile(signalCandidate, context),
    balanced: buildBalancedProfile(signalCandidate, context),
    aggressive: buildAggressiveProfile(signalCandidate, context),
  };

  const active = profiles[riskProfile] || profiles.strict;

  return {
    riskProfile,
    expressionLevel: active.expressionLevel,
    expressionReason: active.expressionReason,
    expressionWarnings: active.expressionWarnings,
    maxRiskBudgetHint: active.maxRiskBudgetHint,
    strictDecisionCode: profiles.strict.decisionCode,
    balancedDecisionCode: profiles.balanced.decisionCode,
    aggressiveDecisionCode: profiles.aggressive.decisionCode,
    strictExpressionLevel: profiles.strict.expressionLevel,
    balancedExpressionLevel: profiles.balanced.expressionLevel,
    aggressiveExpressionLevel: profiles.aggressive.expressionLevel,
    profileEvaluations: profiles,
  };
}

export { normalizeRiskProfile as normalizeRecommendationRiskProfile };
