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
  buildBacktestReview,
  buildPortfolioReview,
} from "../data-hub.js";
import { buildResearchExecutionPlan } from "../lib/research-execution-plan.js";
import { sanitizeDashboardBundle } from "../app/data-guard.js";
import { REFRESH_TIERS, formatRefreshPolicySummary } from "../app/refresh-policy.js";
import {
  readRecommendationSettlementsArtifact,
  readRecommendationSnapshotsArtifact,
} from "../lib/recommendation-artifacts.js";

function readArtifactOrFallback(readArtifact, fallback) {
  const artifact = readArtifact();
  return artifact.length ? artifact : fallback();
}

async function buildSanitizedDashboardBundle() {
  const dashboard = await getDashboardData();
  const normalizedMatches = await buildNormalizedMatchBundle();
  return sanitizeDashboardBundle({ dashboard, normalizedMatches });
}

export async function buildApiPayload() {
  return {
    "/api/health": async () => ({
      ok: true,
      now: new Date().toISOString(),
      service: "guess-worldcup-2026",
    }),
    "/api/dashboard": async () => {
      const bundle = await buildSanitizedDashboardBundle();
      return {
        ...bundle.dashboard,
        dataAudit: bundle.dataAudit,
      };
    },
    "/api/live-matches": async () => {
      const bundle = await buildSanitizedDashboardBundle();
      return bundle.dashboard.liveMatches;
    },
    "/api/tomorrow-predictions": async () => {
      const bundle = await buildSanitizedDashboardBundle();
      return bundle.dashboard.tomorrowPredictions;
    },
    "/api/market-sources": async () => (await getDashboardData()).marketSources,
    "/api/post-match-review": async () => {
      const bundle = await buildSanitizedDashboardBundle();
      return bundle.dashboard.completedComparisons;
    },
    "/api/analysis-items": async () => (await getDashboardData()).analysisItems,
    "/api/modeling-steps": async () => (await getDashboardData()).modelingSteps,
    "/api/expert-opinions": async () => {
      const bundle = await buildSanitizedDashboardBundle();
      return bundle.dashboard.expertOpinions;
    },
    "/api/raw-market-board": async () => (await getPipelineData()).rawMarketBoard,
    "/api/prediction-pipeline": async () => getPipelineData(),
    "/api/data/market-snapshots": async () => (await getPipelineData()).marketSnapshots,
    "/api/data/signal-candidates": async () => (await getPipelineData()).signalCandidates,
    "/api/data/jingcai-recommendations": async () => (await getPipelineData()).jingcaiRecommendations,
    "/api/data/recommendation-snapshots": async () =>
      readArtifactOrFallback(readRecommendationSnapshotsArtifact, async () => (await getPipelineData()).recommendationSnapshots),
    "/api/data/recommendation-settlements": async () =>
      readArtifactOrFallback(readRecommendationSettlementsArtifact, async () => (await getPipelineData()).recommendationSettlements),
    "/api/data/research-execution-plan": async () => {
      const report = await buildDataQualityReport();
      return buildResearchExecutionPlan(report);
    },
    "/api/providers/status": async () => {
      const status = await getProviderStatus();
      return {
        ...status,
        refreshPolicy: {
          tiers: REFRESH_TIERS,
          summary: formatRefreshPolicySummary(),
        },
      };
    },
    "/api/providers/catalog": async () => getSourceCatalog(),
    "/api/data/supplemental-signals": async () => getSupplementalSignals(),
    "/api/data/normalized-matches": async () => {
      const bundle = await buildSanitizedDashboardBundle();
      return bundle.normalizedMatches;
    },
    "/api/data/quality-report": async () => buildDataQualityReport(),
    "/api/data/provider-coverage": async () => buildProviderCoverageReport(),
    "/api/data/portfolio-review": async () => buildPortfolioReview(),
    "/api/data/backtest-review": async () => buildBacktestReview(),
    "/api/data/refresh-policy": async () => ({
      tiers: REFRESH_TIERS,
      summary: formatRefreshPolicySummary(),
    }),
  };
}
