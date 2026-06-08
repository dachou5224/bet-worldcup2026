import { buildUnifiedMatches } from "../app/fixture-match.js";

const FINISHED_STATUSES = new Set(["完场", "已结束", "finished", "已完赛"]);

function isFiniteScore(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getActualOutcome(match) {
  const homeScore = isFiniteScore(match.homeScore);
  const awayScore = isFiniteScore(match.awayScore);

  if (homeScore == null || awayScore == null) {
    return null;
  }

  if (homeScore > awayScore) {
    return "home";
  }

  if (homeScore < awayScore) {
    return "away";
  }

  return "draw";
}

function getPredictedOutcome(prediction) {
  if (!prediction) {
    return null;
  }

  const entries = [
    { outcome: "home", market: prediction.marketHome ?? 0, model: prediction.modelHome ?? 0 },
    { outcome: "draw", market: prediction.marketDraw ?? 0, model: prediction.modelDraw ?? 0 },
    { outcome: "away", market: prediction.marketAway ?? 0, model: prediction.modelAway ?? 0 },
  ];

  entries.sort((a, b) => b.model - a.model || b.market - a.market);
  return entries[0]?.outcome ?? null;
}

function formatOutcomeLabel(match, outcome) {
  if (outcome === "home") {
    return `${match.home}胜`;
  }

  if (outcome === "away") {
    return `${match.away}胜`;
  }

  if (outcome === "draw") {
    return "平局";
  }

  return "待判定";
}

function formatEdge(prediction, outcome) {
  if (!prediction || !outcome) {
    return null;
  }

  const market = {
    home: prediction.marketHome ?? 0,
    draw: prediction.marketDraw ?? 0,
    away: prediction.marketAway ?? 0,
  }[outcome];
  const model = {
    home: prediction.modelHome ?? 0,
    draw: prediction.modelDraw ?? 0,
    away: prediction.modelAway ?? 0,
  }[outcome];

  if (!Number.isFinite(market) || !Number.isFinite(model)) {
    return null;
  }

  const delta = model - market;
  return `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}%`;
}

function buildTakeaway(match, prediction, actualOutcome, predictedOutcome) {
  const mismatch = actualOutcome && predictedOutcome && actualOutcome !== predictedOutcome;
  const confidence = prediction?.confidence || "medium";

  if (!mismatch) {
    return `真实赛果与赛前模型方向一致，适合继续观察这类${confidence}置信度样本的稳定性。`;
  }

  return `赛果偏离赛前模型方向，适合回看盘口漂移、临场阵容和信息延迟。`;
}

function isFinishedMatch(match) {
  if (!match) {
    return false;
  }

  if (FINISHED_STATUSES.has(String(match.status || "").toLowerCase())) {
    return true;
  }

  return FINISHED_STATUSES.has(match.status);
}

function buildReviewRecord(match, prediction, sourceMode) {
  const actualOutcome = getActualOutcome(match);
  const predictedOutcome = getPredictedOutcome(prediction);
  const status = actualOutcome && predictedOutcome && actualOutcome === predictedOutcome ? "hit" : "miss";

  return {
    fixture: match.fixture || `${match.home} vs ${match.away}`,
    predicted: formatOutcomeLabel(match, predictedOutcome),
    actual: formatOutcomeLabel(match, actualOutcome),
    edge: formatEdge(prediction, predictedOutcome),
    takeaway: buildTakeaway(match, prediction, actualOutcome, predictedOutcome),
    status,
    sourceMode,
    finalScore: {
      home: match.homeScore ?? null,
      away: match.awayScore ?? null,
    },
    actualOutcome,
    predictedOutcome,
    matchStatus: match.status ?? null,
  };
}

function summarizeSourceMode(liveMode) {
  if (liveMode === "real") {
    return "live_real";
  }

  if (liveMode === "real_fallback_mock") {
    return "live_real_fallback_mock";
  }

  if (liveMode === "real_unconfigured_fallback_mock") {
    return "live_real_unconfigured_fallback_mock";
  }

  return "fallback_mock";
}

export function buildPostMatchReviewBundle(liveMatches, predictions, fallbackComparisons = [], options = {}) {
  const unifiedMatches = buildUnifiedMatches(liveMatches || [], predictions || []);
  const derivedComparisons = unifiedMatches
    .filter((match) => match.kind === "live" && match.prediction && isFinishedMatch(match))
    .map((match) => buildReviewRecord(match, match.prediction, summarizeSourceMode(options.liveMode)));

  const completedComparisons = derivedComparisons.length ? derivedComparisons : (fallbackComparisons || []);
  const finishedLiveMatches = unifiedMatches.filter((match) => match.kind === "live" && isFinishedMatch(match));
  const finishedLiveMatchCount = finishedLiveMatches.length;
  const matchedPredictionCount = finishedLiveMatches.filter((match) => Boolean(match.prediction)).length;
  const liveDerivedCount = derivedComparisons.length;
  const liveCoverageRate = finishedLiveMatchCount > 0 ? liveDerivedCount / finishedLiveMatchCount : 0;
  const predictionCoverageRate = finishedLiveMatchCount > 0 ? matchedPredictionCount / finishedLiveMatchCount : 0;

  return {
    completedComparisons,
    summary: {
      sourceMode: derivedComparisons.length ? summarizeSourceMode(options.liveMode) : "fallback",
      liveMode: options.liveMode || null,
      derivedCount: liveDerivedCount,
      fallbackCount: derivedComparisons.length ? 0 : completedComparisons.length,
      finishedMatchCount: finishedLiveMatchCount,
      matchedPredictionCount,
      liveDerivedCount,
      liveCoverageRate,
      predictionCoverageRate,
      completedComparisonCount: completedComparisons.length,
      fallbackUsed: derivedComparisons.length === 0 && completedComparisons.length > 0,
    },
  };
}
