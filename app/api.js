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

export async function fetchSignalSlice() {
  const [dashboard, normalizedMatches] = await Promise.all([
    fetchJson("/api/dashboard"),
    fetchJson("/api/data/normalized-matches").catch(() => []),
  ]);

  return { dashboard, normalizedMatches };
}

export async function fetchMetadataSlice() {
  const [qualityReport, providerCoverage, completedComparisons] = await Promise.all([
    fetchJson("/api/data/quality-report").catch(() => null),
    fetchJson("/api/data/provider-coverage").catch(() => null),
    fetchJson("/api/post-match-review").catch(() => null),
  ]);

  return {
    qualityReport,
    providerCoverage,
    completedComparisons: Array.isArray(completedComparisons) ? completedComparisons : null,
  };
}

export async function fetchDashboardBundle() {
  const [signalSlice, metadataSlice] = await Promise.all([
    fetchSignalSlice(),
    fetchMetadataSlice(),
  ]);

  const dashboard = {
    ...signalSlice.dashboard,
    ...(metadataSlice.completedComparisons != null
      ? { completedComparisons: metadataSlice.completedComparisons }
      : {}),
  };

  return sanitizeBundle({
    dashboard,
    normalizedMatches: signalSlice.normalizedMatches,
    qualityReport: metadataSlice.qualityReport,
    providerCoverage: metadataSlice.providerCoverage,
  });
}

export { sanitizeBundle, fetchJson };
