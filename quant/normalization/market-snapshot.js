import { buildFixtureKey } from "../../lib/match-key.js";
import { proportionalDevig } from "../odds/devig.js";

const DEFAULT_PERIOD = "full_time";
const MARKET_TYPE_ALIASES = new Map([
  ["spreads", "spread"],
  ["spread", "spread"],
  ["totals", "total"],
  ["total", "total"],
  ["h2h", "h2h"],
  ["correct_score", "correct_score"],
  ["half_full_time", "half_full_time"],
  ["qualification", "qualification"],
  ["outright", "outright"],
]);

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function toIsoOrFallback(value) {
  if (typeof value !== "string" || !value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
}

function toOptionalNumber(value) {
  return isFiniteNumber(value) ? value : null;
}

function toOptionalString(value) {
  return typeof value === "string" && value ? value : null;
}

function normalizeMarketType(marketType) {
  if (!marketType) {
    return "h2h";
  }

  const lower = String(marketType).trim().toLowerCase();
  return MARKET_TYPE_ALIASES.get(lower) || lower;
}

function normalizeLineValue(value) {
  if (value == null) {
    return null;
  }

  if (isFiniteNumber(value)) {
    return value;
  }

  if (typeof value === "string" && value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : value;
  }

  return null;
}

function normalizeOutcome(outcome) {
  return {
    name: outcome?.name ?? "outcome",
    price: toOptionalNumber(outcome?.price ?? outcome?.decimalOdds ?? outcome?.decimal_odds),
    point: toOptionalNumber(outcome?.point),
    probability: toOptionalNumber(
      outcome?.probability ?? outcome?.fairProbability ?? outcome?.fair_probability,
    ),
    fairProbability: toOptionalNumber(outcome?.fairProbability ?? outcome?.fair_probability),
  };
}

function buildSnapshotGroupKey({ fixtureId, marketType, period, line }) {
  return [fixtureId, marketType, period, line == null ? "*" : line].join("::");
}

function buildSnapshotId({
  fixtureId,
  marketType,
  period,
  line,
  provider,
  bookmaker,
  sourceKind,
  rawEventId,
  rawMarketId,
  capturedAt,
}) {
  return [
    fixtureId,
    marketType,
    period,
    line == null ? "*" : line,
    provider || "*",
    bookmaker || "*",
    sourceKind || "*",
    rawEventId || "*",
    rawMarketId || "*",
    capturedAt || "*",
  ].join("::");
}

function resolveFixtureId(match, options) {
  if (typeof options?.fixtureResolver === "function") {
    const resolved = options.fixtureResolver(match);
    if (resolved != null) {
      return resolved;
    }
  }

  if (match?.fixtureId != null) {
    return match.fixtureId;
  }

  if (match?.id != null) {
    return match.id;
  }

  return buildFixtureKey(match?.home ?? "unknown", match?.away ?? "unknown");
}

function buildSourceMeta({
  region = null,
  rawEventId = null,
  rawMarketId = null,
  liquidity = null,
  volume = null,
  marketNature,
  directEVEligible,
}) {
  return {
    region: toOptionalString(region),
    rawEventId: rawEventId == null ? null : rawEventId,
    rawMarketId: rawMarketId == null ? null : rawMarketId,
    liquidity: toOptionalNumber(liquidity),
    volume: toOptionalNumber(volume),
    marketNature,
    directEVEligible: Boolean(directEVEligible),
  };
}

function buildMarketSnapshot({
  fixtureId,
  fixture,
  provider,
  bookmaker,
  capturedAt,
  marketType,
  line,
  period = DEFAULT_PERIOD,
  outcomes,
  sourceMeta,
  snapshotKind = "bookmaker",
}) {
  const normalizedMarketType = normalizeMarketType(marketType);
  const normalizedLine = normalizeLineValue(line);
  const normalizedCapturedAt = toIsoOrFallback(capturedAt) || new Date().toISOString();
  const normalizedOutcomes = outcomes.map(normalizeOutcome);

  return {
    snapshotId: buildSnapshotId({
      fixtureId,
      marketType: normalizedMarketType,
      period,
      line: normalizedLine,
      provider,
      bookmaker,
      sourceKind: snapshotKind,
      rawEventId: sourceMeta.rawEventId,
      rawMarketId: sourceMeta.rawMarketId,
      capturedAt: normalizedCapturedAt,
    }),
    snapshotGroupKey: buildSnapshotGroupKey({
      fixtureId,
      marketType: normalizedMarketType,
      period,
      line: normalizedLine,
    }),
    fixtureId,
    fixture,
    provider,
    bookmaker,
    capturedAt: normalizedCapturedAt,
    marketType: normalizedMarketType,
    line: normalizedLine,
    period,
    outcomes: normalizedOutcomes,
    sourceMeta,
  };
}

function buildBookmakerH2HSnapshot(match, oddsRecord, fixtureId) {
  const fairOutcomes = proportionalDevig([
    { name: "home", decimalOdds: oddsRecord.odds.home },
    { name: "draw", decimalOdds: oddsRecord.odds.draw },
    { name: "away", decimalOdds: oddsRecord.odds.away },
  ]);

  return buildMarketSnapshot({
    fixtureId,
    fixture: `${match.home} vs ${match.away}`,
    provider: oddsRecord.provider,
    bookmaker: oddsRecord.provider,
    capturedAt: oddsRecord.updatedAt,
    marketType: "h2h",
    line: null,
    period: DEFAULT_PERIOD,
    outcomes: fairOutcomes.map((outcome) => ({
      name: outcome.name,
      price: outcome.decimalOdds,
      point: null,
      probability: outcome.fairProbability,
      fairProbability: outcome.fairProbability,
    })),
    sourceMeta: buildSourceMeta({
      region: oddsRecord.region ?? null,
      rawEventId: oddsRecord.eventId ?? null,
      rawMarketId: oddsRecord.marketId ?? null,
      liquidity: oddsRecord.liquidity ?? null,
      volume: oddsRecord.volume ?? null,
      marketNature: "bookmaker",
      directEVEligible: true,
    }),
    snapshotKind: "bookmaker",
  });
}

function inferMarketTypeFromKey(key) {
  if (!key) {
    return "unknown";
  }

  return normalizeMarketType(key);
}

function inferLineFromMarket(market) {
  if (market?.line != null) {
    return market.line;
  }

  if (market?.point != null) {
    return market.point;
  }

  if (Array.isArray(market?.outcomes)) {
    const pointOutcome = market.outcomes.find((outcome) => outcome?.point != null);
    if (pointOutcome) {
      return pointOutcome.point;
    }
  }

  return null;
}

function buildBookmakerMarketSnapshot(match, oddsRecord, market, fixtureId) {
  const marketType = inferMarketTypeFromKey(market.key);
  const period = toOptionalString(market.period) || DEFAULT_PERIOD;

  return buildMarketSnapshot({
    fixtureId,
    fixture: `${match.home} vs ${match.away}`,
    provider: oddsRecord.provider,
    bookmaker: oddsRecord.provider,
    capturedAt: market.lastUpdate || oddsRecord.updatedAt,
    marketType,
    line: inferLineFromMarket(market),
    period,
    outcomes: (market.outcomes || []).map((outcome) => ({
      name: outcome.name ?? "outcome",
      price: outcome.price ?? null,
      point: outcome.point ?? null,
      probability: null,
      fairProbability: null,
    })),
    sourceMeta: buildSourceMeta({
      region: oddsRecord.region ?? null,
      rawEventId: oddsRecord.eventId ?? null,
      rawMarketId: market.marketId ?? market.id ?? market.key ?? null,
      liquidity: oddsRecord.liquidity ?? null,
      volume: oddsRecord.volume ?? null,
      marketNature: "bookmaker",
      directEVEligible: period === DEFAULT_PERIOD,
    }),
    snapshotKind: "bookmaker",
  });
}

function buildPredictionMarketSnapshot(match, predictionRecord, fixtureId) {
  const probabilities = predictionRecord.probabilities || {};

  return buildMarketSnapshot({
    fixtureId,
    fixture: `${match.home} vs ${match.away}`,
    provider: predictionRecord.provider,
    bookmaker: null,
    capturedAt: predictionRecord.updatedAt,
    marketType: "h2h",
    line: null,
    period: DEFAULT_PERIOD,
    outcomes: [
      { name: "home", price: null, point: null, probability: probabilities.home, fairProbability: null },
      { name: "draw", price: null, point: null, probability: probabilities.draw, fairProbability: null },
      { name: "away", price: null, point: null, probability: probabilities.away, fairProbability: null },
    ],
    sourceMeta: buildSourceMeta({
      region: predictionRecord.region ?? null,
      rawEventId: predictionRecord.eventId ?? null,
      rawMarketId: predictionRecord.marketId ?? null,
      liquidity: predictionRecord.liquidity ?? null,
      volume: predictionRecord.volume ?? null,
      marketNature: "prediction_market",
      directEVEligible: false,
    }),
    snapshotKind: "prediction_market",
  });
}

export function normalizeRawMarketBoard(rawMarketBoard, options = {}) {
  const marketSnapshots = [];

  for (const match of rawMarketBoard || []) {
    const fixtureId = resolveFixtureId(match, options);

    for (const oddsRecord of match?.oddsProviders || []) {
      marketSnapshots.push(buildBookmakerH2HSnapshot(match, oddsRecord, fixtureId));

      for (const market of oddsRecord.markets || []) {
        marketSnapshots.push(buildBookmakerMarketSnapshot(match, oddsRecord, market, fixtureId));
      }
    }

    for (const predictionRecord of match?.predictionMarkets || []) {
      marketSnapshots.push(buildPredictionMarketSnapshot(match, predictionRecord, fixtureId));
    }
  }

  return marketSnapshots;
}

export function isLayerASafeMarketSnapshot(snapshot) {
  return Boolean(
    snapshot &&
      snapshot.sourceMeta?.marketNature === "bookmaker" &&
      snapshot.sourceMeta?.directEVEligible &&
      snapshot.period === DEFAULT_PERIOD &&
      ["h2h", "spread", "total"].includes(snapshot.marketType) &&
      Array.isArray(snapshot.outcomes) &&
      snapshot.outcomes.length > 0,
  );
}

export function summarizeMarketSnapshots(marketSnapshots) {
  const marketTypeCounts = {};
  const fixtureIds = new Set();
  const groupKeys = new Set();

  for (const snapshot of marketSnapshots || []) {
    marketTypeCounts[snapshot.marketType] = (marketTypeCounts[snapshot.marketType] || 0) + 1;
    fixtureIds.add(snapshot.fixtureId);
    groupKeys.add(snapshot.snapshotGroupKey);
  }

  return {
    fixtureCount: fixtureIds.size,
    snapshotCount: (marketSnapshots || []).length,
    groupCount: groupKeys.size,
    marketTypeCounts,
    directEVEligibleCount: (marketSnapshots || []).filter(isLayerASafeMarketSnapshot).length,
    predictionMarketCount: (marketSnapshots || []).filter(
      (snapshot) => snapshot.sourceMeta?.marketNature === "prediction_market",
    ).length,
  };
}

export function buildMarketSnapshotBundle(rawMarketBoard, options = {}) {
  const marketSnapshots = normalizeRawMarketBoard(rawMarketBoard, options);
  return {
    marketSnapshots,
    summary: summarizeMarketSnapshots(marketSnapshots),
  };
}
