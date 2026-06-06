import {
  getMarketDataBundle,
  getStaticPageData,
  getJingcaiOfficialFeed,
} from "./data-sources.js";
import {
  buildMarketSourceSummary,
  buildJingcaiRecommendationsFromMarket,
  buildSignalCandidatesFromMarket,
  buildTomorrowPredictionsFromMarket,
} from "./market-pipeline.js";
import { buildMarketSnapshotBundle } from "./quant/normalization/market-snapshot.js";
import { buildLayeredOutputs } from "./quant/output/layered-output.js";

const tournamentStart = "2026-06-11T13:00:00-05:00";
const tournamentEnd = "2026-07-19T15:00:00-04:00";

function getTournamentPhase(now = new Date()) {
  const start = new Date(tournamentStart);
  const end = new Date(tournamentEnd);

  if (now < start) {
    const diffDays = Math.ceil((start - now) / (1000 * 60 * 60 * 24));
    return `距离开赛还有 ${diffDays} 天`;
  }

  if (now > end) {
    return "本届世界杯已结束";
  }

  return "世界杯进行中";
}

export async function getDashboardData(now = new Date()) {
  const { rawMarketBoard, mode: marketDataMode, providerHealth } = await getMarketDataBundle();
  const staticData = await getStaticPageData();
  const officialFeed = getJingcaiOfficialFeed();
  const expertOpinionMap = new Map(
    staticData.expertOpinions.map((entry) => [entry.fixture, entry.opinions]),
  );
  const jingcaiRecommendations = buildJingcaiRecommendationsFromMarket(rawMarketBoard, officialFeed);
  const jingcaiRecommendationMap = new Map(
    jingcaiRecommendations.map((item) => [item.fixtureId, item]),
  );
  const tomorrowPredictions = buildTomorrowPredictionsFromMarket(rawMarketBoard).map((item) => {
    const jingcaiRecommendation =
      jingcaiRecommendationMap.get(item.id) || jingcaiRecommendationMap.get(Number(item.id)) || null;

    return {
      ...item,
      expertOpinions: expertOpinionMap.get(item.fixture) || [],
      jingcaiRecommendation,
    };
  });
  const layeredOutputs = buildLayeredOutputs(tomorrowPredictions);
  const layeredOutputMap = new Map(layeredOutputs.map((item) => [item.fixtureId, item]));
  const enrichedTomorrowPredictions = tomorrowPredictions.map((item) => ({
    ...item,
    layeredOutput: layeredOutputMap.get(item.id) || layeredOutputMap.get(Number(item.id)) || null,
  }));

  return {
    tournamentStatus: getTournamentPhase(now),
    lastUpdated: now.toISOString(),
    marketDataMode,
    liveDataMode: staticData.liveMode,
    providerHealth,
    liveMatches: staticData.liveMatches,
    tomorrowPredictions: enrichedTomorrowPredictions,
    marketSources: buildMarketSourceSummary(rawMarketBoard),
    analysisItems: staticData.analysisItems,
    completedComparisons: staticData.completedComparisons,
    modelingSteps: staticData.modelingSteps,
    expertOpinions: staticData.expertOpinions,
    jingcaiRecommendations,
    layeredOutputs,
  };
}

export async function getPipelineData() {
  const { rawMarketBoard, mode, providerHealth } = await getMarketDataBundle();
  const marketSnapshotBundle = buildMarketSnapshotBundle(rawMarketBoard);
  const signalCandidates = buildSignalCandidatesFromMarket(rawMarketBoard);
  const jingcaiRecommendations = buildJingcaiRecommendationsFromMarket(
    rawMarketBoard,
    getJingcaiOfficialFeed(),
  );
  const jingcaiRecommendationMap = new Map(
    jingcaiRecommendations.map((item) => [item.fixtureId, item]),
  );
  const tomorrowPredictions = buildTomorrowPredictionsFromMarket(rawMarketBoard).map((item) => ({
    ...item,
    jingcaiRecommendation:
      jingcaiRecommendationMap.get(item.id) || jingcaiRecommendationMap.get(Number(item.id)) || null,
  }));
  const layeredOutputs = buildLayeredOutputs(tomorrowPredictions);
  const layeredOutputMap = new Map(layeredOutputs.map((item) => [item.fixtureId, item]));
  const enrichedTomorrowPredictions = tomorrowPredictions.map((item) => ({
    ...item,
    layeredOutput: layeredOutputMap.get(item.id) || layeredOutputMap.get(Number(item.id)) || null,
  }));

  return {
    mode,
    providerHealth,
    rawMarketBoard,
    tomorrowPredictions: enrichedTomorrowPredictions,
    marketSources: buildMarketSourceSummary(rawMarketBoard),
    marketSnapshots: marketSnapshotBundle.marketSnapshots,
    marketSnapshotSummary: marketSnapshotBundle.summary,
    signalCandidates,
    jingcaiRecommendations,
    layeredOutputs,
  };
}
