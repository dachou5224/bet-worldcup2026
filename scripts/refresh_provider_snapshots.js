import path from "node:path";
import { readFileSync, existsSync } from "node:fs";
import { getPipelineData } from "../dashboard-data.js";
import { getProviderStatus, getSupplementalSignals, getStaticPageData } from "../data-sources.js";
import { buildBacktestRunFromSettlements, writeBacktestRunArtifact } from "../lib/backtest-artifacts.js";
import {
  writeRecommendationSettlementsArtifact,
  writeRecommendationSnapshotsArtifact,
} from "../lib/recommendation-artifacts.js";
import { projectRoot } from "../lib/paths.js";
import { getDashboardData as getDashboardDataBundle } from "../dashboard-data.js";
import { getProviderConfig } from "../provider-config.js";
import { getProviderAdapters } from "../providers/provider-registry.js";
import { loadJingcaiOfficialFeed } from "../providers/jingcai/official-feed.js";
import {
  computePayloadHash,
  resolveSnapshotDirs,
  summarizeOddsCoverage,
  wrapSnapshotPayload,
  writeJsonSnapshot,
  writeSnapshotToTargets,
} from "../lib/snapshot-store.js";

async function captureRawProviderPayloads(adapters, config) {
  const rawCaptures = {
    footballData: null,
    oddsApi: null,
    polymarket: null,
    errors: {},
  };

  if (adapters.live.isConfigured() && adapters.live.id === "football_data_live") {
    try {
      rawCaptures.footballData = await adapters.live.fetchRawMatchesResponse({ bypassCache: true });
    } catch (error) {
      rawCaptures.errors.footballData = error.message;
    }
  }

  if (adapters.odds.isConfigured()) {
    try {
      rawCaptures.oddsApi = await adapters.odds.fetchRawOddsResponse({ bypassCache: true });
    } catch (error) {
      rawCaptures.errors.oddsApi = error.message;
    }
  }

  if (adapters.polymarket.isConfigured()) {
    try {
      rawCaptures.polymarket = await adapters.polymarket.fetchRawEventsResponse({ bypassCache: true });
    } catch (error) {
      rawCaptures.errors.polymarket = error.message;
    }
  }

  return rawCaptures;
}

function buildJingcaiSnapshotEnvelope(config, capturedAt) {
  const feedFile = config.jingcaiOfficialFeedFile;
  const absolutePath = path.isAbsolute(feedFile)
    ? feedFile
    : path.resolve(projectRoot, feedFile);

  if (!existsSync(absolutePath)) {
    return null;
  }

  const raw = JSON.parse(readFileSync(absolutePath, "utf-8"));
  if (raw && typeof raw === "object" && Array.isArray(raw.matches)) {
    return {
      ...raw,
      capturedAt: raw.capturedAt || capturedAt,
    };
  }

  return {
    capturedAt,
    source: "manual_official_snapshot",
    sourceUrl: "https://www.sporttery.cn/jc/zqszsc/",
    manualReviewed: true,
    sourceMode: config.jingcaiOfficialFeedMode === "file" ? "file" : "fixture",
    matches: raw,
  };
}

async function run() {
  const capturedAt = new Date().toISOString();
  const dirs = resolveSnapshotDirs(capturedAt);
  const config = getProviderConfig();
  const adapters = getProviderAdapters();

  const rawCaptures = await captureRawProviderPayloads(adapters, config);

  let providerStatus = null;
  let pipelineData = null;
  let dashboardData = null;
  let liveData = null;
  let supplementalSignals = null;
  let pipelineError = null;

  try {
    [
      providerStatus,
      pipelineData,
      dashboardData,
      liveData,
      supplementalSignals,
    ] = await Promise.all([
      getProviderStatus(),
      getPipelineData(),
      getDashboardDataBundle(),
      getStaticPageData(),
      getSupplementalSignals(),
    ]);
  } catch (error) {
    pipelineError = error.message;
    [liveData, supplementalSignals] = await Promise.all([
      getStaticPageData().catch(() => ({ liveMode: "error", liveMatches: [] })),
      getSupplementalSignals(),
    ]);
    providerStatus = {
      appMode: config.appMode,
      marketDataMode: "error",
      requestedMarketDataMode: config.marketDataMode,
      requestedLiveDataMode: config.liveDataMode,
      pipelineError,
      rawProviderErrors: rawCaptures.errors,
    };
    pipelineData = {
      marketSnapshots: [],
      marketSnapshotSummary: null,
      recommendationSnapshots: [],
      recommendationSnapshotSummary: null,
      recommendationSettlements: [],
      recommendationSettlementSummary: null,
    };
    dashboardData = {
      completedComparisons: [],
      tomorrowPredictions: [],
      postMatchReviewSummary: null,
    };
  }

  const completedComparisons = dashboardData.completedComparisons || [];
  const backtestRunArtifact = buildBacktestRunFromSettlements(
    pipelineData.recommendationSettlements || [],
    dashboardData.tomorrowPredictions || [],
    {
      capturedAt,
      sourceMode: "live_derived",
    },
  );

  const providerStatusPayload = {
    capturedAt,
    appMode: config.appMode,
    pipelineError,
    providerStatus,
    rawProviderMeta: {
      footballData: rawCaptures.footballData?.meta || null,
      oddsApi: rawCaptures.oddsApi?.meta || null,
      polymarket: rawCaptures.polymarket?.meta || null,
    },
    rawProviderErrors: rawCaptures.errors,
    oddsCoverage: rawCaptures.oddsApi?.body
      ? summarizeOddsCoverage(rawCaptures.oddsApi.body)
      : null,
  };

  if (rawCaptures.footballData?.body) {
    const wrapped = wrapSnapshotPayload(rawCaptures.footballData.body, {
      capturedAt: rawCaptures.footballData.meta?.capturedAt || capturedAt,
      source: "football-data.org",
      sourceMode: "real",
      extra: {
        provider: "football-data.org",
        competitionCode: rawCaptures.footballData.meta?.competitionCode,
        dateFrom: rawCaptures.footballData.meta?.dateFrom,
        dateTo: rawCaptures.footballData.meta?.dateTo,
        matchCount: rawCaptures.footballData.meta?.matchCount,
        fromCache: rawCaptures.footballData.meta?.fromCache ?? false,
      },
    });
    writeJsonSnapshot(path.join(dirs.rawDir, "football-data-matches.json"), wrapped);
    writeJsonSnapshot(
      path.join(dirs.versionedDir, "raw", "football-data-matches.json"),
      wrapped,
    );
  }

  if (rawCaptures.oddsApi?.body) {
    const wrapped = wrapSnapshotPayload(rawCaptures.oddsApi.body, {
      capturedAt: rawCaptures.oddsApi.meta?.capturedAt || capturedAt,
      source: "the-odds-api",
      sourceMode: "real",
      extra: {
        provider: "the-odds-api",
        quota: rawCaptures.oddsApi.meta?.quota || null,
        requestedMarkets: rawCaptures.oddsApi.meta?.requestedMarkets || config.oddsMarkets,
        coverage: summarizeOddsCoverage(rawCaptures.oddsApi.body),
        fromCache: rawCaptures.oddsApi.meta?.fromCache ?? false,
      },
    });
    writeJsonSnapshot(path.join(dirs.rawDir, "the-odds-api-h2h.json"), wrapped);
    writeJsonSnapshot(path.join(dirs.versionedDir, "raw", "the-odds-api-h2h.json"), wrapped);
  }

  if (rawCaptures.polymarket?.body) {
    const wrapped = wrapSnapshotPayload(rawCaptures.polymarket.body, {
      capturedAt: rawCaptures.polymarket.meta?.capturedAt || capturedAt,
      source: "polymarket-gamma",
      sourceMode: "real",
      extra: {
        provider: "polymarket-gamma",
        sentimentOnly: true,
        directEVEligible: false,
        semanticMappingConfidence: rawCaptures.polymarket.meta?.semanticMappingConfidence || "low",
        eventCount: rawCaptures.polymarket.meta?.eventCount || rawCaptures.polymarket.body.length,
        fromCache: rawCaptures.polymarket.meta?.fromCache ?? false,
      },
    });
    writeJsonSnapshot(path.join(dirs.rawDir, "polymarket-worldcup.json"), wrapped);
    writeJsonSnapshot(path.join(dirs.versionedDir, "raw", "polymarket-worldcup.json"), wrapped);
  }

  const jingcaiEnvelope = buildJingcaiSnapshotEnvelope(config, capturedAt);
  if (jingcaiEnvelope) {
    const wrapped = {
      ...jingcaiEnvelope,
      sourceMode: config.jingcaiOfficialFeedMode,
      rawPayloadHash: computePayloadHash(jingcaiEnvelope.matches),
      parserVersion: "2026.06.08-agent-b",
    };
    writeSnapshotToTargets({
      fileName: "jingcai-official-feed.json",
      payload: wrapped,
      capturedAt,
      dirs,
    });
  }

  writeSnapshotToTargets({
    fileName: "provider-status.json",
    payload: providerStatusPayload,
    capturedAt,
    dirs,
  });

  writeSnapshotToTargets({
    fileName: "prediction-pipeline.json",
    payload: { capturedAt, pipelineData },
    capturedAt,
    dirs,
  });

  writeSnapshotToTargets({
    fileName: "market-snapshots.json",
    payload: wrapSnapshotPayload(pipelineData.marketSnapshots || [], {
      capturedAt,
      source: "prediction-pipeline",
      sourceMode: providerStatus.marketDataMode || config.marketDataMode,
      extra: {
        summary: pipelineData.marketSnapshotSummary || null,
      },
    }),
    capturedAt,
    dirs,
  });

  writeRecommendationSnapshotsArtifact(
    {
      capturedAt,
      recommendationSnapshots: pipelineData.recommendationSnapshots || [],
      recommendationSnapshotSummary: pipelineData.recommendationSnapshotSummary || null,
    },
    dirs.latestDir,
  );
  writeRecommendationSnapshotsArtifact(
    {
      capturedAt,
      recommendationSnapshots: pipelineData.recommendationSnapshots || [],
      recommendationSnapshotSummary: pipelineData.recommendationSnapshotSummary || null,
    },
    dirs.flatDir,
  );

  writeRecommendationSettlementsArtifact(
    {
      capturedAt,
      recommendationSettlements: pipelineData.recommendationSettlements || [],
      recommendationSettlementSummary: pipelineData.recommendationSettlementSummary || null,
    },
    dirs.latestDir,
  );
  writeRecommendationSettlementsArtifact(
    {
      capturedAt,
      recommendationSettlements: pipelineData.recommendationSettlements || [],
      recommendationSettlementSummary: pipelineData.recommendationSettlementSummary || null,
    },
    dirs.flatDir,
  );

  writeSnapshotToTargets({
    fileName: "live-data.json",
    payload: wrapSnapshotPayload(liveData, {
      capturedAt,
      source: liveData.liveMode === "real" ? "football-data.org" : liveData.liveMode,
      sourceMode: liveData.liveMode === "real" ? "real" : liveData.liveMode,
      extra: {
        liveMode: liveData.liveMode,
        liveMatchCount: liveData.liveMatches?.length || 0,
      },
    }),
    capturedAt,
    dirs,
  });

  writeSnapshotToTargets({
    fileName: "post-match-review.json",
    payload: {
      capturedAt,
      completedComparisons,
      summary: dashboardData.postMatchReviewSummary || null,
    },
    capturedAt,
    dirs,
  });

  writeSnapshotToTargets({
    fileName: "supplemental-signals.json",
    payload: { capturedAt, supplementalSignals },
    capturedAt,
    dirs,
  });

  if (backtestRunArtifact.backtestRun.length > 0) {
    writeBacktestRunArtifact(
      backtestRunArtifact.backtestRun,
      "backtest-run.json",
      dirs.latestDir,
      {
        sourceMode: backtestRunArtifact.sourceMode,
        summary: backtestRunArtifact.summary || null,
      },
    );
    writeBacktestRunArtifact(
      backtestRunArtifact.backtestRun,
      "backtest-run.json",
      dirs.flatDir,
      {
        sourceMode: backtestRunArtifact.sourceMode,
        summary: backtestRunArtifact.summary || null,
      },
    );
  }

  const filesWritten = [
    "provider-status.json",
    "prediction-pipeline.json",
    "market-snapshots.json",
    "recommendation-snapshots.json",
    "recommendation-settlements.json",
    "live-data.json",
    "post-match-review.json",
    "supplemental-signals.json",
    "jingcai-official-feed.json",
    ...(backtestRunArtifact.backtestRun.length > 0 ? ["backtest-run.json"] : []),
    ...(rawCaptures.footballData ? ["raw/football-data-matches.json"] : []),
    ...(rawCaptures.oddsApi ? ["raw/the-odds-api-h2h.json"] : []),
    ...(rawCaptures.polymarket ? ["raw/polymarket-worldcup.json"] : []),
  ];

  console.log(
    JSON.stringify(
      {
        ok: true,
        capturedAt,
        outputDirs: {
          latest: dirs.latestDir,
          versioned: dirs.versionedDir,
          flat: dirs.flatDir,
        },
        files: filesWritten,
        rawProviderErrors: rawCaptures.errors,
        providerModes: {
          market: providerStatus?.marketDataMode || "error",
          live: liveData.liveMode,
          jingcai: config.jingcaiOfficialFeedMode,
        },
        pipelineError,
        oddsQuota: rawCaptures.oddsApi?.meta?.quota || null,
        oddsCoverage: providerStatusPayload.oddsCoverage,
      },
      null,
      2,
    ),
  );
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
