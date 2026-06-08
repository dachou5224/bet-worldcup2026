import { proportionalDevig } from "../odds/devig.js";
import { buildScoreMatrix } from "./score-matrix.js";
import { calibrateScoreModel } from "./calibration.js";
import { priceH2H } from "../pricing/h2h.js";
import { priceSpread } from "../pricing/spread.js";
import { priceTotal } from "../pricing/total.js";

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round(value, digits = 4) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function average(values) {
  if (!values.length) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function normalizeOutcomeMap(snapshot) {
  const outcomes = snapshot?.outcomes || [];
  const hasProbabilities = outcomes.every(
    (outcome) => isFiniteNumber(outcome.probability) || isFiniteNumber(outcome.fairProbability),
  );

  if (hasProbabilities) {
    return outcomes.reduce((acc, outcome) => {
      acc[outcome.name] = outcome.probability ?? outcome.fairProbability;
      return acc;
    }, {});
  }

  const priceOutcomes = outcomes.filter((outcome) => isFiniteNumber(outcome.price));
  if (!priceOutcomes.length) {
    return {};
  }

  const fairOutcomes = proportionalDevig(priceOutcomes.map((outcome) => ({
    name: outcome.name,
    decimalOdds: outcome.price,
  })));

  return fairOutcomes.reduce((acc, outcome) => {
    acc[outcome.name] = outcome.fairProbability;
    return acc;
  }, {});
}

function collectOutcomeNames(bookmakerSnapshots, predictionSnapshots) {
  const names = new Set();

  for (const snapshot of [...bookmakerSnapshots, ...predictionSnapshots]) {
    for (const outcome of snapshot.outcomes || []) {
      if (typeof outcome?.name === "string" && outcome.name) {
        names.add(outcome.name);
      }
    }
  }

  return Array.from(names);
}

function averageOutcomeMaps(snapshots, outcomeNames) {
  const result = {};

  for (const outcomeName of outcomeNames) {
    const values = snapshots
      .map((snapshot) => normalizeOutcomeMap(snapshot)[outcomeName])
      .filter((value) => isFiniteNumber(value));
    result[outcomeName] = average(values);
  }

  return result;
}

function blendProbabilities(bookmaker, prediction, bookmakerWeight = 0.7) {
  const keys = new Set([...Object.keys(bookmaker || {}), ...Object.keys(prediction || {})]);
  const blended = {};

  for (const key of keys) {
    const marketValue = isFiniteNumber(bookmaker[key]) ? bookmaker[key] : null;
    const modelValue = isFiniteNumber(prediction[key]) ? prediction[key] : null;

    if (marketValue == null && modelValue == null) {
      continue;
    }

    if (marketValue == null) {
      blended[key] = modelValue;
      continue;
    }

    if (modelValue == null) {
      blended[key] = marketValue;
      continue;
    }

    blended[key] = bookmakerWeight * marketValue + (1 - bookmakerWeight) * modelValue;
  }

  return blended;
}

function normalizeDistributionMap(map) {
  const total = Object.values(map).reduce((sum, value) => sum + (isFiniteNumber(value) ? value : 0), 0);
  if (total <= 0) {
    return map;
  }

  const normalized = {};
  for (const [key, value] of Object.entries(map)) {
    normalized[key] = isFiniteNumber(value) ? value / total : value;
  }
  return normalized;
}

function summarizeDisagreement(marketMap, modelMap, outcomeNames) {
  const diffs = outcomeNames.map((outcomeName) => {
    const marketValue = isFiniteNumber(marketMap[outcomeName]) ? marketMap[outcomeName] : 0;
    const modelValue = isFiniteNumber(modelMap[outcomeName]) ? modelMap[outcomeName] : 0;
    return Math.abs(modelValue - marketValue);
  });

  return {
    total: diffs.reduce((sum, value) => sum + value, 0),
    max: diffs.length ? Math.max(...diffs) : 0,
    average: diffs.length ? diffs.reduce((sum, value) => sum + value, 0) / diffs.length : 0,
  };
}

function classifyConfidence(disagreementTotal) {
  if (disagreementTotal > 0.12) {
    return "low";
  }

  if (disagreementTotal > 0.07) {
    return "medium";
  }

  return "high";
}

function selectPrimarySnapshot(bookmakerSnapshots, predictionSnapshots) {
  const all = [...bookmakerSnapshots, ...predictionSnapshots];
  if (!all.length) {
    return null;
  }

  return [...all].sort((a, b) => String(b.capturedAt).localeCompare(String(a.capturedAt)))[0];
}

function buildMarketTypePricing(scoreMatrix, marketType, line) {
  if (marketType === "h2h") {
    return priceH2H(scoreMatrix);
  }

  if (marketType === "spread") {
    return priceSpread(scoreMatrix, line ?? 0);
  }

  if (marketType === "total") {
    return priceTotal(scoreMatrix, line ?? 2.5);
  }

  return null;
}

function buildDummyScoreMatrix() {
  return buildScoreMatrix({ homeLambda: 1.35, awayLambda: 1.08, maxGoals: 10 });
}

export function buildMarketBaseline(
  marketSnapshots,
  {
    fixtureId,
    marketType = "h2h",
    line = null,
    period = "full_time",
    contextSnapshots = marketSnapshots,
  } = {},
) {
  const relevantSnapshots = (marketSnapshots || []).filter((snapshot) => {
    if (fixtureId != null && snapshot.fixtureId !== fixtureId) {
      return false;
    }

    if (snapshot.marketType !== marketType) {
      return false;
    }

    if (snapshot.period !== period) {
      return false;
    }

    if (line != null && snapshot.line !== line) {
      return false;
    }

    return true;
  });

  const bookmakerSnapshots = relevantSnapshots.filter(
    (snapshot) => snapshot.sourceMeta?.marketNature === "bookmaker",
  );
  const predictionSnapshots = relevantSnapshots.filter(
    (snapshot) => snapshot.sourceMeta?.marketNature === "prediction_market",
  );
  const primarySnapshot = selectPrimarySnapshot(bookmakerSnapshots, predictionSnapshots);
  const outcomeNames = collectOutcomeNames(bookmakerSnapshots, predictionSnapshots);
  const bookmakerConsensus = normalizeDistributionMap(averageOutcomeMaps(bookmakerSnapshots, outcomeNames));
  const predictionConsensus = normalizeDistributionMap(averageOutcomeMaps(predictionSnapshots, outcomeNames));
  const hasBookmaker = bookmakerSnapshots.length > 0;
  const hasPredictionMarket = predictionSnapshots.length > 0;
  const dataOk = Boolean(primarySnapshot && outcomeNames.length > 0 && hasBookmaker);

  const calibration = calibrateScoreModel(
    {
      fixtureId: primarySnapshot?.fixtureId ?? fixtureId ?? null,
      fixture: primarySnapshot?.fixture ?? null,
      marketType,
      line,
      period,
    },
    {
      contextSnapshots,
    },
  );

  const scoreMatrix = calibration.scoreMatrix || buildDummyScoreMatrix();
  const pricing = buildMarketTypePricing(scoreMatrix, marketType, line);

  let modelConsensus = normalizeDistributionMap(blendProbabilities(bookmakerConsensus, predictionConsensus));
  if (marketType === "spread" && pricing?.home && outcomeNames.length >= 2) {
    const [homeOutcomeName, awayOutcomeName] = outcomeNames;
    const spreadModelMap = normalizeDistributionMap({
      [homeOutcomeName]: pricing.home.fullWin + pricing.home.push,
      [awayOutcomeName]: pricing.away.fullWin + pricing.away.push,
    });
    modelConsensus = spreadModelMap;
  }
  if (marketType === "total" && pricing?.over && outcomeNames.length >= 2) {
    const [overOutcomeName, underOutcomeName] = outcomeNames;
    const totalModelMap = normalizeDistributionMap({
      [overOutcomeName]: pricing.over.fullWin + pricing.over.push,
      [underOutcomeName]: pricing.under.fullWin + pricing.under.push,
    });
    modelConsensus = totalModelMap;
  }

  const finalDisagreement = summarizeDisagreement(bookmakerConsensus, modelConsensus, outcomeNames);
  const confidence = classifyConfidence(finalDisagreement.total);

  const riskTags = [];
  if (!hasPredictionMarket) {
    riskTags.push("prediction_market_missing");
  }
  if (finalDisagreement.total > 0.12) {
    riskTags.push("high_market_dispersion");
  } else if (finalDisagreement.total > 0.07) {
    riskTags.push("moderate_market_dispersion");
  }
  if (!primarySnapshot) {
    riskTags.push("no_primary_snapshot");
  }

  return {
    fixtureId: primarySnapshot?.fixtureId ?? fixtureId ?? null,
    fixture: primarySnapshot?.fixture ?? null,
    marketType,
    line,
    period,
    primarySnapshot,
    bookmakerSnapshots,
    predictionSnapshots,
    outcomeNames,
    bookmakerConsensus,
    predictionConsensus,
    modelConsensus,
    disagreement: finalDisagreement,
    confidence,
    dataOk,
    playMappable: ["h2h", "spread", "total"].includes(marketType) && period === "full_time",
    riskTags,
    pricing,
    scoreMatrix,
    calibration,
    calibrationMode: calibration.mode,
    calibrationConfidence: calibration.confidence,
  };
}

export function buildMarketBaselineBundle(marketSnapshots) {
  const groups = new Map();
  const fixtureGroups = new Map();

  for (const snapshot of marketSnapshots || []) {
    const fixtureKey = String(snapshot.fixtureId);
    const currentFixture = fixtureGroups.get(fixtureKey) || [];
    currentFixture.push(snapshot);
    fixtureGroups.set(fixtureKey, currentFixture);

    const key = [snapshot.fixtureId, snapshot.marketType, snapshot.period, snapshot.line ?? "*"].join("::");
    const current = groups.get(key) || [];
    current.push(snapshot);
    groups.set(key, current);
  }

  const baselines = Array.from(groups.entries()).map(([key, snapshots]) => {
    const [fixtureId, marketType, period, lineToken] = key.split("::");
    const parsedFixtureId = Number(fixtureId);
    const normalizedFixtureId = Number.isFinite(parsedFixtureId) ? parsedFixtureId : fixtureId;
    const parsedLine = lineToken === "*" ? null : Number(lineToken);
    const contextSnapshots = fixtureGroups.get(String(normalizedFixtureId)) || snapshots;
    return buildMarketBaseline(snapshots, {
      fixtureId: normalizedFixtureId,
      marketType,
      line: lineToken === "*" ? null : Number.isFinite(parsedLine) ? parsedLine : lineToken,
      period,
      contextSnapshots,
    });
  });

  return {
    baselines,
    summary: {
      baselineCount: baselines.length,
      confidenceBuckets: baselines.reduce((acc, baseline) => {
        acc[baseline.confidence] = (acc[baseline.confidence] || 0) + 1;
        return acc;
      }, {}),
      hasPricingCount: baselines.filter((baseline) => baseline.pricing != null).length,
      calibrationModeCounts: baselines.reduce((acc, baseline) => {
        acc[baseline.calibrationMode] = (acc[baseline.calibrationMode] || 0) + 1;
        return acc;
      }, {}),
    },
  };
}

export function selectOutcomeProbabilityMap(baseline, source = "model") {
  const map =
    source === "market"
      ? baseline.bookmakerConsensus
      : source === "prediction"
        ? baseline.predictionConsensus
        : baseline.modelConsensus;

  return map || {};
}

export function getBaselineOutcomePrice(baseline, outcomeName) {
  const snapshot = baseline.primarySnapshot;
  if (!snapshot) {
    return null;
  }

  const outcome = (snapshot.outcomes || []).find((item) => item.name === outcomeName);
  return isFiniteNumber(outcome?.price) ? outcome.price : null;
}
