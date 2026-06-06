import { sanitizeDashboardBundle } from "./data-guard.js";

async function fetchJson(path) {
  const response = await fetch(path, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`${path} failed: ${response.status}`);
  }
  return response.json();
}

function sanitizeBundle(parts) {
  return sanitizeDashboardBundle({
    dashboard: parts.dashboard,
    normalizedMatches: Array.isArray(parts.normalizedMatches) ? parts.normalizedMatches : [],
    qualityReport: parts.qualityReport ?? null,
    providerCoverage: parts.providerCoverage ?? null,
  });
}

export async function fetchLiveSchedule() {
  return fetchJson("/api/live-matches");
}

/** 信号层：只拉预测/盘口/标准化比赛，不含 liveMatches */
export async function fetchSignalSlice() {
  const [tomorrowPredictions, marketSources, normalizedMatches, expertOpinions] =
    await Promise.all([
      fetchJson("/api/tomorrow-predictions"),
      fetchJson("/api/market-sources"),
      fetchJson("/api/data/normalized-matches").catch(() => []),
      fetchJson("/api/expert-opinions").catch(() => []),
    ]);

  return {
    tomorrowPredictions,
    marketSources,
    normalizedMatches,
    expertOpinions,
  };
}

export async function fetchMetadataSlice() {
  const [qualityReport, providerCoverage, completedComparisons, portfolioReview, backtestReview] = await Promise.all([
    fetchJson("/api/data/quality-report").catch(() => null),
    fetchJson("/api/data/provider-coverage").catch(() => null),
    fetchJson("/api/post-match-review").catch(() => null),
    fetchJson("/api/data/portfolio-review").catch(() => null),
    fetchJson("/api/data/backtest-review").catch(() => null),
  ]);

  return {
    qualityReport,
    providerCoverage,
    completedComparisons: Array.isArray(completedComparisons) ? completedComparisons : null,
    portfolioReview,
    backtestReview,
  };
}

function mergeSignalFields(currentDashboard, signalSlice) {
  return {
    ...currentDashboard,
    tomorrowPredictions: signalSlice.tomorrowPredictions,
    marketSources: signalSlice.marketSources,
    expertOpinions: signalSlice.expertOpinions,
  };
}

export async function fetchDashboardBundle() {
  const [signalSlice, metadataSlice, liveMatches, dashboardShell] = await Promise.all([
    fetchSignalSlice(),
    fetchMetadataSlice(),
    fetchLiveSchedule(),
    fetchJson("/api/dashboard"),
  ]);

  const dashboard = mergeSignalFields(
    {
      ...dashboardShell,
      liveMatches,
      ...(metadataSlice.completedComparisons != null
        ? { completedComparisons: metadataSlice.completedComparisons }
        : {}),
      ...(metadataSlice.portfolioReview != null ? { portfolioReview: metadataSlice.portfolioReview } : {}),
      ...(metadataSlice.backtestReview != null ? { backtestReview: metadataSlice.backtestReview } : {}),
    },
    signalSlice,
  );

  return sanitizeBundle({
    dashboard,
    normalizedMatches: signalSlice.normalizedMatches,
    qualityReport: metadataSlice.qualityReport,
    providerCoverage: metadataSlice.providerCoverage,
  });
}

export { sanitizeBundle, fetchJson, mergeSignalFields };
