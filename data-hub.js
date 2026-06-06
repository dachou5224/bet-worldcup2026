import { getDashboardData, getPipelineData } from "./dashboard-data.js";
import { getProviderStatus } from "./data-sources.js";
import { validateExpertOpinions } from "./schemas/expert-opinions.js";
import { validateLiveMatches } from "./schemas/live-matches.js";
import { validateRawMarketBoard } from "./schemas/market-board.js";
import { validateNormalizedMatches } from "./schemas/normalized-matches.js";

function toIsoOrNull(value) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function getConsensusLean(prediction) {
  const entries = [
    { key: "home", value: prediction.modelHome },
    { key: "draw", value: prediction.modelDraw },
    { key: "away", value: prediction.modelAway },
  ].sort((a, b) => b.value - a.value);

  return entries[0].key;
}

function summarizeExpertLean(opinions) {
  if (!opinions.length) {
    return {
      count: 0,
      leaningBuckets: {},
      topLean: "none",
    };
  }

  const leaningBuckets = opinions.reduce((acc, opinion) => {
    acc[opinion.stance] = (acc[opinion.stance] || 0) + 1;
    return acc;
  }, {});

  const topLean = Object.entries(leaningBuckets).sort((a, b) => b[1] - a[1])[0][0];

  return {
    count: opinions.length,
    leaningBuckets,
    topLean,
  };
}

function countBookmakerMarkets(oddsProviders, marketKey) {
  return oddsProviders.reduce(
    (count, provider) =>
      count + (provider.markets || []).filter((market) => market.key === marketKey).length,
    0,
  );
}

function hasPolymarketLiquidityMetrics(predictionMarkets) {
  return predictionMarkets.some(
    (provider) => provider.liquidity != null || provider.volume != null || provider.openInterest != null,
  );
}

export async function buildNormalizedMatchBundle() {
  const dashboard = await getDashboardData();
  const pipeline = await getPipelineData();
  const providerStatus = await getProviderStatus();
  const rawByFixture = new Map(
    pipeline.rawMarketBoard.map((match) => [`${match.home} vs ${match.away}`, match]),
  );

  return dashboard.tomorrowPredictions.map((prediction) => {
    const rawMatch = rawByFixture.get(prediction.fixture);
    const expertSummary = summarizeExpertLean(prediction.expertOpinions || []);

    return {
      fixtureId: prediction.id,
      fixture: prediction.fixture,
      kickoffLabel: prediction.kickoff,
      tournamentStatus: dashboard.tournamentStatus,
      freshnessLabel: prediction.freshness,
      derivedAt: dashboard.lastUpdated,
      consensus: {
        market: {
          home: prediction.marketHome,
          draw: prediction.marketDraw,
          away: prediction.marketAway,
        },
        model: {
          home: prediction.modelHome,
          draw: prediction.modelDraw,
          away: prediction.modelAway,
        },
        modelLean: getConsensusLean(prediction),
        confidence: prediction.confidence,
      },
      providers: {
        oddsCount: rawMatch?.oddsProviders.length || 0,
        predictionMarketCount: rawMatch?.predictionMarkets.length || 0,
        spreadsCount: countBookmakerMarkets(rawMatch?.oddsProviders || [], "spreads"),
        totalsCount: countBookmakerMarkets(rawMatch?.oddsProviders || [], "totals"),
        providerMode: providerStatus.marketDataMode,
      },
      expertOpinionSummary: expertSummary,
      expertOpinions: (prediction.expertOpinions || []).map((opinion) => ({
        pundit: opinion.pundit,
        region: opinion.region,
        stance: opinion.stance,
        confidence: opinion.confidence,
        capturedAt: toIsoOrNull(opinion.capturedAt),
        summary: opinion.summary,
        signalTags: opinion.signalTags,
      })),
      rawSources: {
        oddsProviders:
          rawMatch?.oddsProviders.map((provider) => ({
            provider: provider.provider,
            updatedAt: toIsoOrNull(provider.updatedAt),
            odds: provider.odds,
            markets: (provider.markets || []).map((market) => ({
              key: market.key,
              lastUpdate: toIsoOrNull(market.lastUpdate),
              outcomes: market.outcomes,
            })),
          })) || [],
        predictionMarkets:
          rawMatch?.predictionMarkets.map((provider) => ({
            provider: provider.provider,
            updatedAt: toIsoOrNull(provider.updatedAt),
            probabilities: provider.probabilities,
            eventId: provider.eventId ?? null,
            eventSlug: provider.eventSlug ?? null,
            marketId: provider.marketId ?? null,
            marketSlug: provider.marketSlug ?? null,
            conditionId: provider.conditionId ?? null,
            question: provider.question ?? null,
            enableOrderBook: provider.enableOrderBook ?? null,
            liquidity: provider.liquidity ?? null,
            volume: provider.volume ?? null,
            openInterest: provider.openInterest ?? null,
            volume24hr: provider.volume24hr ?? null,
            volume1wk: provider.volume1wk ?? null,
            volume1mo: provider.volume1mo ?? null,
            volume1yr: provider.volume1yr ?? null,
            outcomes: provider.outcomes || [],
            outcomePrices: provider.outcomePrices || [],
          })) || [],
      },
    };
  });
}

export async function buildDataQualityReport() {
  const dashboard = await getDashboardData();
  const pipeline = await getPipelineData();
  const providerStatus = await getProviderStatus();
  const liveValidation = validateLiveMatches(dashboard.liveMatches);
  const expertValidation = validateExpertOpinions(dashboard.expertOpinions);
  const schemaValidation = validateRawMarketBoard(pipeline.rawMarketBoard);
  const normalizedMatches = await buildNormalizedMatchBundle();
  const normalizedValidation = validateNormalizedMatches(normalizedMatches);
  const issues = [];

  const matches = pipeline.rawMarketBoard.map((match) => {
    const hasOdds = match.oddsProviders.length > 0;
    const hasPredictionMarket = match.predictionMarkets.length > 0;
    const spreadsCount = countBookmakerMarkets(match.oddsProviders, "spreads");
    const totalsCount = countBookmakerMarkets(match.oddsProviders, "totals");
    const timestamps = [
      ...match.oddsProviders.map((provider) => provider.updatedAt),
      ...match.predictionMarkets.map((provider) => provider.updatedAt),
    ];

    if (!hasOdds) {
      issues.push({
        severity: "high",
        fixture: `${match.home} vs ${match.away}`,
        code: "missing_odds_provider",
        message: "该比赛缺少赔率来源。",
      });
    }

    if (!hasPredictionMarket) {
      issues.push({
        severity: "medium",
        fixture: `${match.home} vs ${match.away}`,
        code: "missing_prediction_market",
        message: "该比赛缺少预测市场来源。",
      });
    }

    return {
      fixture: `${match.home} vs ${match.away}`,
      oddsProviderCount: match.oddsProviders.length,
      predictionMarketCount: match.predictionMarkets.length,
      spreadsCount,
      totalsCount,
      hasLiquidityMetrics: hasPolymarketLiquidityMetrics(match.predictionMarkets),
      latestSourceUpdate: timestamps.sort().slice(-1)[0] || null,
      hasOdds,
      hasPredictionMarket,
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    providerMode: providerStatus.marketDataMode,
    matchCount: matches.length,
    schemaOk: schemaValidation.ok,
    schemaErrors: schemaValidation.errors,
    liveSchemaOk: liveValidation.ok,
    liveSchemaErrors: liveValidation.errors,
    expertSchemaOk: expertValidation.ok,
    expertSchemaErrors: expertValidation.errors,
    normalizedSchemaOk: normalizedValidation.ok,
    normalizedSchemaErrors: normalizedValidation.errors,
    issueCount: issues.length,
    issues,
    matches,
  };
}

export async function buildProviderCoverageReport() {
  const pipeline = await getPipelineData();
  const usage = new Map();

  for (const match of pipeline.rawMarketBoard) {
    for (const provider of match.oddsProviders) {
      const current = usage.get(provider.provider) || {
        name: provider.provider,
        type: "odds",
        fixtures: 0,
      };
      current.fixtures += 1;
      usage.set(provider.provider, current);
    }

    for (const provider of match.predictionMarkets) {
      const current = usage.get(provider.provider) || {
        name: provider.provider,
        type: "prediction_market",
        fixtures: 0,
      };
      current.fixtures += 1;
      usage.set(provider.provider, current);
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    providers: Array.from(usage.values()).sort((a, b) => b.fixtures - a.fixtures),
  };
}
