import { getMarketDataBundle, getStaticPageData } from "./data-sources.js";
import {
  buildMarketSourceSummary,
  buildTomorrowPredictionsFromMarket,
} from "./market-pipeline.js";

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
  const expertOpinionMap = new Map(
    staticData.expertOpinions.map((entry) => [entry.fixture, entry.opinions]),
  );
  const tomorrowPredictions = buildTomorrowPredictionsFromMarket(rawMarketBoard).map((item) => ({
    ...item,
    expertOpinions: expertOpinionMap.get(item.fixture) || [],
  }));

  return {
    tournamentStatus: getTournamentPhase(now),
    lastUpdated: now.toISOString(),
    marketDataMode,
    liveDataMode: staticData.liveMode,
    providerHealth,
    liveMatches: staticData.liveMatches,
    tomorrowPredictions,
    marketSources: buildMarketSourceSummary(rawMarketBoard),
    analysisItems: staticData.analysisItems,
    completedComparisons: staticData.completedComparisons,
    modelingSteps: staticData.modelingSteps,
    expertOpinions: staticData.expertOpinions,
  };
}

export async function getPipelineData() {
  const { rawMarketBoard, mode, providerHealth } = await getMarketDataBundle();

  return {
    mode,
    providerHealth,
    rawMarketBoard,
    tomorrowPredictions: buildTomorrowPredictionsFromMarket(rawMarketBoard),
    marketSources: buildMarketSourceSummary(rawMarketBoard),
  };
}
