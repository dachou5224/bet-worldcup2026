import { getDashboardData, getPipelineData } from "../dashboard-data.js";
import {
  getProviderStatus,
  getSourceCatalog,
  getSupplementalSignals,
} from "../data-sources.js";
import {
  buildDataQualityReport,
  buildNormalizedMatchBundle,
  buildProviderCoverageReport,
} from "../data-hub.js";

export async function buildApiPayload() {
  return {
    "/api/health": async () => ({
      ok: true,
      now: new Date().toISOString(),
      service: "guess-worldcup-2026",
    }),
    "/api/dashboard": async () => getDashboardData(),
    "/api/live-matches": async () => (await getDashboardData()).liveMatches,
    "/api/tomorrow-predictions": async () => (await getDashboardData()).tomorrowPredictions,
    "/api/market-sources": async () => (await getDashboardData()).marketSources,
    "/api/post-match-review": async () => (await getDashboardData()).completedComparisons,
    "/api/analysis-items": async () => (await getDashboardData()).analysisItems,
    "/api/modeling-steps": async () => (await getDashboardData()).modelingSteps,
    "/api/expert-opinions": async () => (await getDashboardData()).expertOpinions,
    "/api/raw-market-board": async () => (await getPipelineData()).rawMarketBoard,
    "/api/prediction-pipeline": async () => getPipelineData(),
    "/api/providers/status": async () => getProviderStatus(),
    "/api/providers/catalog": async () => getSourceCatalog(),
    "/api/data/supplemental-signals": async () => getSupplementalSignals(),
    "/api/data/normalized-matches": async () => buildNormalizedMatchBundle(),
    "/api/data/quality-report": async () => buildDataQualityReport(),
    "/api/data/provider-coverage": async () => buildProviderCoverageReport(),
  };
}
