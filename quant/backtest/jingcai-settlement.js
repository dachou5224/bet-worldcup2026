import { settleMarketBet } from "./settlement.js";

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function round(value, digits = 4) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function settleJingcaiRecommendation(recommendation, options = {}) {
  if (!recommendation?.primaryRecommendation) {
    return {
      playType: recommendation?.primaryRecommendation?.playType ?? null,
      selection: recommendation?.primaryRecommendation?.selection ?? null,
      handicap: recommendation?.primaryRecommendation?.handicap ?? null,
      officialOddsAtRecommendation: null,
      officialOddsAtStopSale: null,
      resultCode: null,
      stakeUnits: 0,
      payoutMultiple: 0,
      realizedReturnOfficial: 0,
      settlement: "no_recommendation",
    };
  }

  const primary = recommendation.primaryRecommendation;
  const finalScore = options.finalScore || recommendation.finalScore || null;
  const officialOddsAtRecommendation = options.officialOddsAtRecommendation ?? primary.officialOdds ?? null;
  const officialOddsAtStopSale = options.officialOddsAtStopSale ?? primary.officialOdds ?? null;
  const stakeUnits = options.stakeUnits ?? primary.suggestedStakeUnits ?? 1;

  const settlement = settleMarketBet(
    {
      marketType: primary.playType === "让球胜平负" ? "spread" : "h2h",
      playType: primary.playType,
      selectionCode: primary.selectionCode,
      selection: primary.selection,
      handicap: primary.handicap,
      officialOddsAtRecommendation,
      finalScore,
      stakeUnits,
    },
    {
      finalScore,
      handicap: primary.handicap,
      stakeUnits,
      odds: officialOddsAtStopSale,
    },
  );

  const realizedReturnOfficial = isFiniteNumber(settlement.payoutMultiple)
    ? round((settlement.payoutMultiple - 1) * stakeUnits)
    : 0;

  return {
    playType: primary.playType,
    selection: primary.selection,
    handicap: primary.handicap,
    officialOddsAtRecommendation,
    officialOddsAtStopSale,
    resultCode: settlement.resultCode,
    stakeUnits,
    payoutMultiple: settlement.payoutMultiple,
    realizedReturnOfficial,
    settlement: settlement.settlement,
  };
}

export function buildJingcaiSettlementReview(recommendations, options = {}) {
  const entries = (recommendations || [])
    .filter((recommendation) => recommendation?.primaryRecommendation)
    .map((recommendation) => ({
      fixtureId: recommendation.fixtureId,
      fixture: `${recommendation.homeTeam} vs ${recommendation.awayTeam}`,
      jingcaiSettlement: settleJingcaiRecommendation(recommendation, options.results?.[recommendation.fixtureId] || {}),
    }));

  return {
    generatedAt: new Date().toISOString(),
    entries,
    settlementCount: entries.length,
  };
}
