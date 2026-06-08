import { getDashboardData, getPipelineData } from "./dashboard-data.js";
import { getBacktestRun, getProviderStatus } from "./data-sources.js";
import { validateExpertOpinions } from "./schemas/expert-opinions.js";
import { validateLiveMatches } from "./schemas/live-matches.js";
import { validateRawMarketBoard } from "./schemas/market-board.js";
import { validateNormalizedMatches } from "./schemas/normalized-matches.js";
import { buildMarketSnapshotBundle } from "./quant/normalization/market-snapshot.js";
import { validateMarketSnapshots } from "./schemas/market-snapshot.js";
import { buildPortfolioExposure } from "./quant/portfolio/exposure.js";
import { computeBrier, computeClosingLineValue, computeLogLoss, summarizeBacktestRecords } from "./quant/backtest/metrics.js";
import { settleMarketBet } from "./quant/backtest/settlement.js";
import { settleJingcaiRecommendation } from "./quant/backtest/jingcai-settlement.js";

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

function toDate(value) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getSnapshotLine(marketSnapshots, fixtureId, marketType) {
  const snapshot = (marketSnapshots || []).find(
    (entry) => String(entry.fixtureId) === String(fixtureId) && entry.marketType === marketType,
  );
  return snapshot?.line ?? null;
}

function summarizeProviderConflictLevel(prediction) {
  if (prediction?.confidence === "low") {
    return "high";
  }

  if (prediction?.confidence === "medium") {
    return "medium";
  }

  return "low";
}

function isStaleSourceUpdate(latestSourceUpdate, generatedAt, thresholdHours = 6) {
  const latest = toDate(latestSourceUpdate);
  const generated = toDate(generatedAt);

  if (!latest || !generated) {
    return true;
  }

  const diffHours = (generated.getTime() - latest.getTime()) / (1000 * 60 * 60);
  return diffHours > thresholdHours;
}

function hasClosingOrPreCloseSnapshot(marketSnapshots, fixtureId, kickoffLabel) {
  const kickoff = toDate(kickoffLabel);
  if (!kickoff) {
    return false;
  }

  return (marketSnapshots || []).some((snapshot) => {
    if (String(snapshot.fixtureId) !== String(fixtureId)) {
      return false;
    }

    const capturedAt = toDate(snapshot.capturedAt);
    if (!capturedAt) {
      return false;
    }

    const diffHours = (kickoff.getTime() - capturedAt.getTime()) / (1000 * 60 * 60);
    return diffHours >= 0 && diffHours <= 24;
  });
}

function buildLayerAReadiness({
  hasOdds,
  hasPredictionMarket,
  marketSnapshotCount,
  hasTimestampedSnapshots,
  hasClosingOrPreCloseSnapshot,
  staleOdds,
  spreadLine,
  totalLine,
  bookmakerDiversity,
}) {
  const blockReasons = [];

  if (!hasOdds) {
    blockReasons.push("missing_odds");
  }

  if (!marketSnapshotCount) {
    blockReasons.push("missing_market_snapshots");
  }

  if (!hasTimestampedSnapshots) {
    blockReasons.push("missing_timestamped_snapshot");
  }

  if (!hasClosingOrPreCloseSnapshot) {
    blockReasons.push("missing_closing_snapshot");
  }

  if (staleOdds) {
    blockReasons.push("stale_odds");
  }

  if (!Number.isFinite(bookmakerDiversity) || bookmakerDiversity <= 0) {
    blockReasons.push("missing_bookmaker_diversity");
  }

  if (!Number.isFinite(spreadLine) && !Number.isFinite(totalLine)) {
    blockReasons.push("missing_spread_total");
  }

  return {
    canEnterLayerA: blockReasons.length === 0,
    blockReasons,
    hasPredictionMarket,
  };
}

function toProbabilityOutcome(actualOutcome) {
  if (actualOutcome === "home") {
    return { home: 1, draw: 0, away: 0 };
  }

  if (actualOutcome === "draw") {
    return { home: 0, draw: 1, away: 0 };
  }

  if (actualOutcome === "away") {
    return { home: 0, draw: 0, away: 1 };
  }

  return null;
}

function buildBacktestReviewFromRun(backtestRun) {
  const reviewed = (backtestRun || []).map((record) => {
    const settlement = settleMarketBet(record, {
      finalScore: record.finalScore,
      handicap: record.line,
      line: record.line,
      odds: record.officialOddsAtStopSale,
      stakeUnits: record.stakeUnits,
    });

    const jingcaiSettlement = settleJingcaiRecommendation(
      {
        primaryRecommendation: {
          playType: record.playType,
          selection: record.selection,
          selectionCode: record.selectionCode,
          handicap: record.line,
          officialOdds: record.officialOddsAtRecommendation,
          suggestedStakeUnits: record.stakeUnits,
        },
      },
      {
        finalScore: record.finalScore,
        officialOddsAtRecommendation: record.officialOddsAtRecommendation,
        officialOddsAtStopSale: record.officialOddsAtStopSale,
        stakeUnits: record.stakeUnits,
      },
    );

    const brier = computeBrier(record.modelBeforeKickoff, record.actualOutcome);
    const logLoss = computeLogLoss(record.modelBeforeKickoff, record.actualOutcome);
    const clv = computeClosingLineValue(record.officialOddsAtRecommendation, record.officialOddsAtStopSale);
    const calibrationError = (() => {
      const probabilities = toProbabilityOutcome(record.actualOutcome);
      if (!probabilities || !record.modelBeforeKickoff) {
        return null;
      }

      return Math.abs((record.modelBeforeKickoff[record.actualOutcome] ?? 0) - 1);
    })();

    return {
      fixtureId: record.fixtureId,
      fixture: record.fixture,
      actualOutcome: record.actualOutcome,
      finalScore: record.finalScore,
      marketClose: record.marketClose,
      modelBeforeKickoff: record.modelBeforeKickoff,
      officialOddsAtRecommendation: record.officialOddsAtRecommendation,
      officialOddsAtStopSale: record.officialOddsAtStopSale,
      stakeUnits: record.stakeUnits,
      settlement,
      realizedReturn: settlement.realizedReturn,
      closingLineValue: clv,
      calibrationError,
      reviewText: record.observation,
      jingcaiSettlement,
      brier,
      logLoss,
    };
  });

  const aggregate = summarizeBacktestRecords(reviewed);

  return {
    generatedAt: new Date().toISOString(),
    recordCount: reviewed.length,
    records: reviewed,
    ...aggregate,
  };
}

function buildPortfolioReviewFromDashboard(dashboard, pipeline) {
  const candidateSignals = (dashboard.jingcaiRecommendations || [])
    .filter((recommendation) => recommendation?.primaryRecommendation)
    .map((recommendation) => ({
      fixtureId: recommendation.fixtureId,
      fixture: `${recommendation.homeTeam} vs ${recommendation.awayTeam}`,
      kickoffLocal: recommendation.kickoffLocal,
      marketType: recommendation.primaryRecommendation.playType === "让球胜平负" ? "spread" : "h2h",
      line: recommendation.primaryRecommendation.handicap,
      outcome: recommendation.primaryRecommendation.selection,
      selectionCode: recommendation.primaryRecommendation.selectionCode,
      recommendationLevel: recommendation.primaryRecommendation.recommendationLevel,
      officialExpectedValue: recommendation.primaryRecommendation.officialExpectedValue,
      officialFinalStakeFraction: recommendation.primaryRecommendation.suggestedStakeUnits
        ? recommendation.primaryRecommendation.suggestedStakeUnits * 0.01
        : 0,
      officialOdds: recommendation.primaryRecommendation.officialOdds,
      stage: recommendation.matchLabel,
    }));

  return buildPortfolioExposure(candidateSignals, {
    portfolioId: `portfolio-${dashboard.lastUpdated.slice(0, 10)}`,
    generatedAt: dashboard.lastUpdated,
    totalRiskBudget: 0.05,
    singleMatchBudget: 0.02,
    dayBudget: 0.03,
    factorBudget: 0.02,
  });
}

export async function buildPortfolioReview() {
  const dashboard = await getDashboardData();
  const pipeline = await getPipelineData();
  return buildPortfolioReviewFromDashboard(dashboard, pipeline);
}

export async function buildBacktestReview() {
  return buildBacktestReviewFromRun(getBacktestRun());
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
  const marketSnapshotBundle = buildMarketSnapshotBundle(pipeline.rawMarketBoard);
  const marketSnapshotValidation = validateMarketSnapshots(marketSnapshotBundle.marketSnapshots);
  const normalizedMatches = await buildNormalizedMatchBundle();
  const normalizedValidation = validateNormalizedMatches(normalizedMatches);
  const issues = [];
  const snapshotTypeCounts = marketSnapshotBundle.summary.marketTypeCounts;
  const layeredOutputs = dashboard.layeredOutputs || [];
  const portfolioReview = buildPortfolioReviewFromDashboard(dashboard, pipeline);
  const backtestReview = buildBacktestReviewFromRun(getBacktestRun());
  const predictionLookup = new Map(
    dashboard.tomorrowPredictions.map((prediction) => [prediction.fixture, prediction]),
  );
  const jingcaiLookup = new Map(
    (dashboard.jingcaiRecommendations || []).map((recommendation) => [recommendation.fixtureId, recommendation]),
  );
  const marketFallbackUsed = providerStatus.marketDataMode === "real_fallback_mock";
  const liveFallbackUsed =
    dashboard.liveDataMode === "real_fallback_mock" || dashboard.liveDataMode === "real_unconfigured_fallback_mock";
  const jingcaiFallbackUsed = providerStatus.jingcaiOfficialFeedMode !== "real";
  const fallbackUsed = marketFallbackUsed || liveFallbackUsed || jingcaiFallbackUsed;
  const researchSafe =
    providerStatus.appMode === "research" &&
    providerStatus.marketDataMode === "real" &&
    dashboard.liveDataMode === "real" &&
    providerStatus.jingcaiOfficialFeedMode === "real" &&
    !fallbackUsed;

  const matches = pipeline.rawMarketBoard.map((match) => {
    const hasOdds = match.oddsProviders.length > 0;
    const hasPredictionMarket = match.predictionMarkets.length > 0;
    const spreadsCount = countBookmakerMarkets(match.oddsProviders, "spreads");
    const totalsCount = countBookmakerMarkets(match.oddsProviders, "totals");
    const timestamps = [
      ...match.oddsProviders.map((provider) => provider.updatedAt),
      ...match.predictionMarkets.map((provider) => provider.updatedAt),
    ];
    const prediction = predictionLookup.get(`${match.home} vs ${match.away}`) || null;
    const jingcaiRecommendation = jingcaiLookup.get(match.id) || jingcaiLookup.get(String(match.id)) || null;
    const fixtureSnapshots = marketSnapshotBundle.marketSnapshots.filter((snapshot) => {
      return String(snapshot.fixtureId) === String(match.id);
    });
    const marketSnapshotCount = marketSnapshotBundle.marketSnapshots.filter((snapshot) => {
      return snapshot.fixtureId === match.id || snapshot.fixtureId === String(match.id);
    }).length;
    const latestSourceUpdate = timestamps.sort().slice(-1)[0] || null;
    const hasTimestampedSnapshots = fixtureSnapshots.some((snapshot) => Boolean(snapshot.capturedAt));
    const hasSettlementResult = dashboard.completedComparisons.some(
      (comparison) => comparison.fixture === `${match.home} vs ${match.away}`,
    );
    const spreadLine = getSnapshotLine(fixtureSnapshots, match.id, "spread");
    const totalLine = getSnapshotLine(fixtureSnapshots, match.id, "total");
    const bookmakerDiversity = new Set(match.oddsProviders.map((provider) => provider.provider)).size;
    const officialScheduleAvailable = Boolean(
      jingcaiRecommendation && jingcaiRecommendation.noJingcaiReason !== "skip_not_in_schedule",
    );
    const mappingConfidence = jingcaiRecommendation?.primaryRecommendation?.mappingConfidence || null;
    const staleOdds = isStaleSourceUpdate(latestSourceUpdate, dashboard.lastUpdated);
    const providerConflictLevel = summarizeProviderConflictLevel(prediction);
    const hasClosingSnapshot = hasClosingOrPreCloseSnapshot(
      fixtureSnapshots,
      match.id,
      match.kickoff,
    );
    const layerAReadiness = buildLayerAReadiness({
      hasOdds,
      hasPredictionMarket,
      marketSnapshotCount,
      hasTimestampedSnapshots,
      hasClosingOrPreCloseSnapshot: hasClosingSnapshot,
      staleOdds,
      spreadLine,
      totalLine,
      bookmakerDiversity,
    });

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
      latestSourceUpdate,
      hasOdds,
      hasPredictionMarket,
      marketSnapshotCount,
      bookmakerDiversity,
      layerAReadiness,
      qualitySignals: {
        hasTimestampedSnapshots,
        hasClosingOrPreCloseSnapshot: hasClosingSnapshot,
        hasSettlementResult,
        spreadLine,
        totalLine,
        staleOdds,
        providerConflictLevel,
        mappingConfidence,
        officialScheduleAvailable,
      },
    };
  });

  if (!marketSnapshotBundle.marketSnapshots.length) {
    issues.push({
      severity: "high",
      fixture: "all",
      code: "missing_market_snapshots",
      message: "市场快照流为空，无法进入 Layer A 研究。",
    });
  }

  if (!snapshotTypeCounts.h2h) {
    issues.push({
      severity: "high",
      fixture: "all",
      code: "missing_h2h_snapshots",
      message: "市场快照中缺少 h2h 类型，无法做基础胜平负研究。",
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    appMode: providerStatus.appMode,
    providerMode: providerStatus.marketDataMode,
    sourceMode: {
      market: providerStatus.marketDataMode,
      live: dashboard.liveDataMode,
      jingcai: providerStatus.jingcaiOfficialFeedMode,
    },
    fallbackUsed: {
      market: marketFallbackUsed,
      live: liveFallbackUsed,
      jingcai: jingcaiFallbackUsed,
      any: fallbackUsed,
    },
    researchSafe,
    matchCount: matches.length,
    schemaOk: schemaValidation.ok,
    schemaErrors: schemaValidation.errors,
    liveSchemaOk: liveValidation.ok,
    liveSchemaErrors: liveValidation.errors,
    expertSchemaOk: expertValidation.ok,
    expertSchemaErrors: expertValidation.errors,
    normalizedSchemaOk: normalizedValidation.ok,
    normalizedSchemaErrors: normalizedValidation.errors,
    marketSnapshotSchemaOk: marketSnapshotValidation.ok,
    marketSnapshotSchemaErrors: marketSnapshotValidation.errors,
    marketSnapshotSummary: marketSnapshotBundle.summary,
    layerCoverage: {
      layerA: layeredOutputs.filter((output) => Boolean(output.layerA?.signalCandidate)).length,
      layerB: layeredOutputs.filter((output) => Boolean(output.layerB?.mappingConfidence)).length,
      layerC: layeredOutputs.filter((output) => Boolean(output.layerC?.primaryRecommendation)).length,
    },
    layerAReadyCount: matches.filter((match) => match.layerAReadiness?.canEnterLayerA).length,
    portfolioReview,
    backtestReview,
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
