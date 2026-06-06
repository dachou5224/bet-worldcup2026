import { edge as calcEdge, expectedValue, relativeEdge, shrinkProbability } from "../edge/ev.js";
import { capStake, fractionalKelly, fullKelly } from "../portfolio/kelly.js";

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function round(value, digits = 4) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function formatPct(value, digits = 1) {
  if (!isFiniteNumber(value)) {
    return "n/a";
  }

  return `${(value * 100).toFixed(digits)}%`;
}

function normalizeCaps(input = {}) {
  return {
    singleCap: isFiniteNumber(input.singleCap) ? input.singleCap : 1,
    fixtureCapRemain: isFiniteNumber(input.fixtureCapRemain) ? input.fixtureCapRemain : 1,
    dayCapRemain: isFiniteNumber(input.dayCapRemain) ? input.dayCapRemain : 1,
    factorCapRemain: isFiniteNumber(input.factorCapRemain) ? input.factorCapRemain : 1,
  };
}

function normalizeProbability(value) {
  return isFiniteNumber(value) ? Math.min(1, Math.max(0, value)) : null;
}

function buildRecommendationText({
  offeredOdds,
  marketProbability,
  modelProbability,
  adjustedProbability,
  expectedValueValue,
  cappedStakeFraction,
  recommendationLevel,
  riskTags,
}) {
  const riskText = riskTags?.length ? riskTags.join("、") : "无显著额外风险标签";

  return [
    `市场定价：该选项当前赔率为 ${isFiniteNumber(offeredOdds) ? offeredOdds.toFixed(2) : "n/a"}，去水后市场隐含概率约为 ${formatPct(marketProbability)}。`,
    `模型判断：模型原始概率为 ${formatPct(modelProbability)}，经过 alpha 收缩后，可用概率为 ${formatPct(adjustedProbability)}。`,
    `决策结果：按 P_adj 计算 EV 为 ${isFiniteNumber(expectedValueValue) ? `${(expectedValueValue * 100).toFixed(1)}%` : "n/a"}，分数 Kelly 风险预算为 ${isFiniteNumber(cappedStakeFraction) ? `${(cappedStakeFraction * 100).toFixed(2)}%` : "n/a"}，当前等级为 ${recommendationLevel}。`,
    `风险说明：${riskText}。`,
  ].join("");
}

function mapDecisionLevel({ decisionCode, confidence, finalStakeFraction, minActionStake }) {
  if (decisionCode.startsWith("skip")) {
    return "NO_ACTION";
  }

  if (decisionCode.startsWith("watch")) {
    return "WATCH";
  }

  if (confidence === "low") {
    return "WATCH";
  }

  if (finalStakeFraction <= 0) {
    return "NO_ACTION";
  }

  if (finalStakeFraction < minActionStake) {
    return "CANDIDATE";
  }

  return "SMALL_POSITION";
}

export function buildSignalCandidate({
  fixtureId,
  marketType,
  line = null,
  period = "full_time",
  outcome,
  offeredOdds,
  marketProbability,
  modelProbability,
  alpha = 0.4,
  confidence = "medium",
  riskTags = [],
  playMappable = true,
  dataOk = true,
  evThreshold = 0.03,
  minStakeFraction = 0.01,
  minActionStake = 0.01,
  kellyFraction = 0.25,
  caps = {},
  marketBaseline = null,
}) {
  const normalizedMarketProbability = normalizeProbability(marketProbability);
  const normalizedModelProbability = normalizeProbability(modelProbability);
  const normalizedOfferedOdds = isFiniteNumber(offeredOdds) && offeredOdds > 1 ? offeredOdds : null;
  const capSettings = normalizeCaps(caps);
  const effectiveRiskTags = [...riskTags];

  if (!dataOk || normalizedMarketProbability == null || normalizedModelProbability == null || normalizedOfferedOdds == null) {
    const decisionCode = "skip_bad_data";
    return {
      fixtureId,
      marketType,
      line,
      period,
      outcome,
      offeredOdds: normalizedOfferedOdds,
      marketProbability: normalizedMarketProbability,
      modelProbability: normalizedModelProbability,
      adjustedProbability: null,
      edge: null,
      relativeEdge: null,
      expectedValue: null,
      rawKelly: null,
      fractionalKelly: null,
      cappedStakeFraction: 0,
      confidence,
      riskTags: effectiveRiskTags.length ? effectiveRiskTags : ["bad_data"],
      decisionCode,
      recommendationLevel: "NO_ACTION",
      recommendationText: buildRecommendationText({
        offeredOdds: normalizedOfferedOdds,
        marketProbability: normalizedMarketProbability,
        modelProbability: normalizedModelProbability,
        adjustedProbability: null,
        expectedValueValue: null,
        cappedStakeFraction: 0,
        recommendationLevel: "NO_ACTION",
        riskTags: effectiveRiskTags.length ? effectiveRiskTags : ["bad_data"],
      }),
      playMappable: false,
      kellyFraction,
      marketBaseline,
    };
  }

  if (!playMappable) {
    const decisionCode = "skip_unmapped_play";
    return {
      fixtureId,
      marketType,
      line,
      period,
      outcome,
      offeredOdds: normalizedOfferedOdds,
      marketProbability: normalizedMarketProbability,
      modelProbability: normalizedModelProbability,
      adjustedProbability: null,
      edge: null,
      relativeEdge: null,
      expectedValue: null,
      rawKelly: null,
      fractionalKelly: null,
      cappedStakeFraction: 0,
      confidence,
      riskTags: [...effectiveRiskTags, "play_unmapped"],
      decisionCode,
      recommendationLevel: "NO_ACTION",
      recommendationText: buildRecommendationText({
        offeredOdds: normalizedOfferedOdds,
        marketProbability: normalizedMarketProbability,
        modelProbability: normalizedModelProbability,
        adjustedProbability: null,
        expectedValueValue: null,
        cappedStakeFraction: 0,
        recommendationLevel: "NO_ACTION",
        riskTags: [...effectiveRiskTags, "play_unmapped"],
      }),
      playMappable: false,
      kellyFraction,
      marketBaseline,
    };
  }

  const adjustedProbability = shrinkProbability(normalizedModelProbability, normalizedMarketProbability, alpha);
  const edgeValue = calcEdge(adjustedProbability, normalizedMarketProbability);
  const relativeEdgeValue = relativeEdge(adjustedProbability, normalizedMarketProbability);
  const expectedValueValue = expectedValue(normalizedOfferedOdds, adjustedProbability);
  const rawKellyValue = fullKelly(normalizedOfferedOdds, adjustedProbability);
  const fractionalKellyValue = fractionalKelly(normalizedOfferedOdds, adjustedProbability, kellyFraction);
  const cappedStakeFraction = capStake(fractionalKellyValue, {
    singleBetCap: capSettings.singleCap,
    matchCap: capSettings.fixtureCapRemain,
    dayCap: capSettings.dayCapRemain,
  });
  const finalStakeFraction = Math.min(cappedStakeFraction, capSettings.factorCapRemain);
  const riskCapBreached = finalStakeFraction <= 0 && fractionalKellyValue > 0;

  let decisionCode;
  if (adjustedProbability <= normalizedMarketProbability) {
    decisionCode = "skip_no_adjusted_edge";
  } else if (expectedValueValue <= evThreshold) {
    decisionCode = "watch_ev_too_low";
  } else if (rawKellyValue <= 0) {
    decisionCode = "skip_negative_kelly";
  } else if (fractionalKellyValue < minStakeFraction) {
    decisionCode = "watch_stake_too_small";
  } else if (riskCapBreached) {
    decisionCode = "skip_risk_cap";
  } else {
    decisionCode = "candidate_positive_ev";
  }

  const recommendationLevel = mapDecisionLevel({
    decisionCode,
    confidence,
    finalStakeFraction,
    minActionStake,
  });

  const recommendationText = buildRecommendationText({
    offeredOdds: normalizedOfferedOdds,
    marketProbability: normalizedMarketProbability,
    modelProbability: normalizedModelProbability,
    adjustedProbability,
    expectedValueValue,
    cappedStakeFraction: finalStakeFraction,
    recommendationLevel,
    riskTags: effectiveRiskTags,
  });

  return {
    fixtureId,
    marketType,
    line,
    period,
    outcome,
    offeredOdds: normalizedOfferedOdds,
    marketProbability: normalizedMarketProbability,
    modelProbability: normalizedModelProbability,
    adjustedProbability,
    edge: round(edgeValue),
    relativeEdge: round(relativeEdgeValue),
    expectedValue: round(expectedValueValue),
    rawKelly: round(rawKellyValue),
    fractionalKelly: round(fractionalKellyValue),
    cappedStakeFraction: round(finalStakeFraction),
    confidence,
    riskTags: effectiveRiskTags,
    decisionCode,
    recommendationLevel,
    recommendationText,
    playMappable: true,
    kellyFraction,
    marketBaseline,
  };
}

export function buildSignalCandidatesFromBaseline(baseline, options = {}) {
  const {
    alpha = 0.4,
    evThreshold = 0.03,
    minStakeFraction = 0.01,
    minActionStake = 0.01,
    kellyFraction = 0.25,
    caps = {},
  } = options;

  const marketProbabilityMap = baseline.bookmakerConsensus || {};
  const modelProbabilityMap = baseline.modelConsensus || {};
  const candidates = [];

  for (const outcome of baseline.outcomeNames || []) {
    const offeredOdds = baseline.primarySnapshot?.outcomes?.find((item) => item.name === outcome)?.price ?? null;
    candidates.push(
      buildSignalCandidate({
        fixtureId: baseline.fixtureId,
        marketType: baseline.marketType,
        line: baseline.line,
        period: baseline.period,
        outcome,
        offeredOdds,
        marketProbability: marketProbabilityMap[outcome],
        modelProbability: modelProbabilityMap[outcome],
        alpha,
        confidence: baseline.confidence,
        riskTags: baseline.riskTags,
        playMappable: baseline.playMappable,
        dataOk: baseline.dataOk,
        evThreshold,
        minStakeFraction,
        minActionStake,
        kellyFraction,
        caps,
        marketBaseline: baseline,
      }),
    );
  }

  return candidates;
}

export function pickPrimarySignalCandidate(candidates) {
  if (!candidates.length) {
    return null;
  }

  const ranking = {
    SMALL_POSITION: 4,
    CANDIDATE: 3,
    WATCH: 2,
    NO_ACTION: 1,
  };

  return [...candidates].sort((a, b) => {
    const levelDelta = (ranking[b.recommendationLevel] || 0) - (ranking[a.recommendationLevel] || 0);
    if (levelDelta !== 0) {
      return levelDelta;
    }

    const evDelta = (b.expectedValue || -Infinity) - (a.expectedValue || -Infinity);
    if (evDelta !== 0) {
      return evDelta;
    }

    return (b.cappedStakeFraction || 0) - (a.cappedStakeFraction || 0);
  })[0];
}
