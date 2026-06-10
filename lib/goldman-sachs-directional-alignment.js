import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  compareDirectionalAlignment,
  gsResultTypeToOutcome,
  inferMarketLean,
} from "./goldman-sachs-fixture-join.js";
import { buildMatchPairKey } from "./goldman-sachs-team-aliases.js";
import { projectRoot } from "./paths.js";

export const DEFAULT_GS_JOINED_FILE =
  "fixtures/fundamental-priors/goldman_sachs_worldcup2026_group_stage_joined.json";

const OUTCOME_LABELS = {
  home: "主胜",
  draw: "平局",
  away: "客胜",
};

let cachedIndex = null;
let cachedIndexPath = null;

function resolveJoinedPath(filePath = DEFAULT_GS_JOINED_FILE) {
  return path.isAbsolute(filePath) ? filePath : path.join(projectRoot, filePath);
}

function round(value, digits = 4) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function normalizeProbability(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return value > 1 ? value / 100 : value;
}

export function extractMarketH2hFromBaseline(baseline) {
  const pricingOutcomes = baseline?.pricing?.outcomes;
  if (Array.isArray(pricingOutcomes) && pricingOutcomes.length) {
    const probs = {};
    for (const outcome of pricingOutcomes) {
      if (outcome?.name) {
        probs[outcome.name] = normalizeProbability(outcome.probability);
      }
    }
    if (probs.home != null || probs.draw != null || probs.away != null) {
      return {
        home: probs.home ?? null,
        draw: probs.draw ?? null,
        away: probs.away ?? null,
      };
    }
  }

  const home = normalizeProbability(
    baseline?.bookmakerConsensus?.home ?? baseline?.modelConsensus?.home ?? null,
  );
  const draw = normalizeProbability(
    baseline?.bookmakerConsensus?.draw ?? baseline?.modelConsensus?.draw ?? null,
  );
  const away = normalizeProbability(
    baseline?.bookmakerConsensus?.away ?? baseline?.modelConsensus?.away ?? null,
  );

  if (home == null && draw == null && away == null) {
    return null;
  }

  return { home, draw, away };
}

export function extractMarketH2hFromPrediction(prediction) {
  const fromBaseline = extractMarketH2hFromBaseline(prediction?.marketBaseline);
  if (fromBaseline) {
    return fromBaseline;
  }

  const home = normalizeProbability(prediction?.marketHome);
  const draw = normalizeProbability(prediction?.marketDraw);
  const away = normalizeProbability(prediction?.marketAway);

  if (home == null && draw == null && away == null) {
    return null;
  }

  return { home, draw, away };
}

export function buildGoldmanJoinedIndex(joinedEnvelope) {
  const byFixtureId = new Map();
  const byPairKey = new Map();

  for (const match of joinedEnvelope?.joinedMatches || []) {
    if (match.fixtureId != null) {
      byFixtureId.set(Number(match.fixtureId), match);
    }
    if (match.pairKey) {
      byPairKey.set(match.pairKey, match);
    }
  }

  return {
    generatedAt: joinedEnvelope?.generatedAt || null,
    summary: joinedEnvelope?.summary || null,
    byFixtureId,
    byPairKey,
  };
}

export function loadGoldmanJoinedIndex(options = {}) {
  const filePath = resolveJoinedPath(options.filePath || DEFAULT_GS_JOINED_FILE);
  if (cachedIndex && cachedIndexPath === filePath) {
    return cachedIndex;
  }

  if (!existsSync(filePath)) {
    return buildGoldmanJoinedIndex({ joinedMatches: [] });
  }

  const joinedEnvelope = JSON.parse(readFileSync(filePath, "utf-8"));
  cachedIndex = buildGoldmanJoinedIndex(joinedEnvelope);
  cachedIndexPath = filePath;
  return cachedIndex;
}

export function resetGoldmanJoinedIndexCache() {
  cachedIndex = null;
  cachedIndexPath = null;
}

export function lookupGoldmanJoinedMatch(prediction, index = loadGoldmanJoinedIndex()) {
  const fixtureId = Number(prediction?.id ?? prediction?.fixtureId);
  if (Number.isFinite(fixtureId) && index.byFixtureId.has(fixtureId)) {
    return index.byFixtureId.get(fixtureId);
  }

  const homeTeam = prediction?.homeTeamEn || prediction?.rawMatch?.homeEn || null;
  const awayTeam = prediction?.awayTeamEn || prediction?.rawMatch?.awayEn || null;
  if (homeTeam && awayTeam) {
    return index.byPairKey.get(buildMatchPairKey(homeTeam, awayTeam)) || null;
  }

  return null;
}

export function buildDirectionalAlignmentForPrediction(prediction, options = {}) {
  const index = options.index || loadGoldmanJoinedIndex(options);
  const joined = lookupGoldmanJoinedMatch(prediction, index);

  if (!joined) {
    return {
      status: "no_gs_match",
      source: "goldman_sachs_modal_exhibit_5",
      fixtureId: prediction?.id ?? prediction?.fixtureId ?? null,
      directionalAlignment: "unknown",
      note: "当前 fixture 不在 GS 小组赛 join 覆盖内",
    };
  }

  const marketH2h = extractMarketH2hFromPrediction(prediction) || joined.marketH2h || null;
  const marketLean = marketH2h ? inferMarketLean(marketH2h) : joined.marketLean || null;
  const directionalAlignment = compareDirectionalAlignment(joined.gsResultType, marketLean);

  return {
    status: "ready",
    source: "goldman_sachs_modal_exhibit_5",
    reportDate: "2026-05-29",
    fixtureId: joined.fixtureId ?? prediction?.id ?? prediction?.fixtureId ?? null,
    pairKey: joined.pairKey,
    group: joined.group,
    matchDay: joined.matchDay,
    scoreline: joined.scoreline,
    gsOutcome: joined.gsOutcome,
    gsOutcomeLabel: OUTCOME_LABELS[joined.gsOutcome] || joined.gsOutcome,
    gsResultType: joined.gsResultType,
    marketH2h: marketH2h
      ? {
          home: marketH2h.home == null ? null : round(marketH2h.home),
          draw: marketH2h.draw == null ? null : round(marketH2h.draw),
          away: marketH2h.away == null ? null : round(marketH2h.away),
        }
      : null,
    marketLean,
    marketLeanLabel: marketLean ? OUTCOME_LABELS[marketLean] || marketLean : null,
    directionalAlignment,
    comparisonScope: "modal_forecast_vs_market_h2h_lean",
    note: "GS modal 比分方向 vs 市场 h2h 众数；不是概率 edge",
  };
}

export function summarizeDirectionalAlignmentBlock(block) {
  if (!block || block.status !== "ready") {
    return block;
  }

  return {
    status: block.status,
    source: block.source,
    reportDate: block.reportDate,
    fixtureId: block.fixtureId,
    scoreline: block.scoreline,
    gsOutcome: block.gsOutcome,
    gsOutcomeLabel: block.gsOutcomeLabel,
    marketLean: block.marketLean,
    marketLeanLabel: block.marketLeanLabel,
    marketH2h: block.marketH2h,
    directionalAlignment: block.directionalAlignment,
    comparisonScope: block.comparisonScope,
    note: block.note,
  };
}
