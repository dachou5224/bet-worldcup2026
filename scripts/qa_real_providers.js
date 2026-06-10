import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  validateAbLiveDataSnapshot,
  validateAbOddsRawSnapshot,
  validateAbProviderStatusSnapshot,
} from "../lib/snapshot-ab-contract.js";
import { loadLocalEnv } from "../lib/load-env.js";
import { projectRoot } from "../lib/paths.js";
import { allowsProviderFallback } from "../lib/app-mode.js";
import { getProviderAdapters, getMockProvider } from "../providers/provider-registry.js";
import { mergeMarketSources } from "../services/market-board-service.js";
import { validateRawMarketBoard } from "../schemas/market-board.js";
import { getMarketDataBundle, getProviderStatus, getStaticPageData } from "../data-sources.js";
import { getProviderConfig } from "../provider-config.js";
import { loadJingcaiOfficialFeed } from "../providers/jingcai/official-feed.js";
import { summarizeOddsCoverage } from "../lib/snapshot-store.js";

loadLocalEnv();

const REQUIRED_LIVE_FIELDS = ["id", "utcDate", "status", "homeTeam", "awayTeam", "score", "stage", "group", "matchday"];

function validateFootballDataFields(matches) {
  const errors = [];
  const sample = matches[0];

  if (!sample) {
    errors.push("football-data 返回 0 场比赛");
    return errors;
  }

  for (const field of REQUIRED_LIVE_FIELDS) {
    if (!(field in sample)) {
      errors.push(`football-data 缺少字段: ${field}`);
    }
  }

  return errors;
}

function buildResearchGuardrails(config, providerStatus, staticPageData) {
  const issues = [];

  if (config.appMode === "research") {
    if (providerStatus.marketDataMode.includes("fallback")) {
      issues.push(`research 模式下 market 发生 fallback: ${providerStatus.marketDataMode}`);
    }

    if (providerStatus.marketDataMode === "error") {
      issues.push(`research 模式下 market 数据不可用: ${providerStatus.pipelineError || providerStatus.marketBundleError || "unknown"}`);
    }

    if (staticPageData.liveMode.includes("fallback")) {
      issues.push(`research 模式下 live 发生 fallback: ${staticPageData.liveMode}`);
    }

    if (staticPageData.liveMode === "error") {
      issues.push("research 模式下 live 数据不可用");
    }

    if (providerStatus.providerHealth?.source === "fallback_mock") {
      issues.push("research 模式下 market providerHealth.source=fallback_mock");
    }
  }

  return issues;
}

async function run() {
  const adapters = getProviderAdapters();
  const providerConfig = getProviderConfig();
  const result = {
    checkedAt: new Date().toISOString(),
    appMode: providerConfig.appMode,
    researchMode: providerConfig.appMode === "research",
    allowsFallback: allowsProviderFallback(providerConfig.appMode),
    adapters: {},
    snapshotPaths: {},
    researchGuardrails: [],
  };

  for (const [name, adapter] of Object.entries(adapters)) {
    if (!adapter.isConfigured()) {
      result.adapters[name] = { status: "skipped", reason: "provider not configured" };
      continue;
    }

    try {
      if (name === "live") {
        let response = null;
        try {
          response = await adapter.fetchRawMatchesResponse({ bypassCache: false });
        } catch (error) {
          result.adapters[name] = { status: "error", message: error.message, providerId: adapter.id };
          continue;
        }
        const rawMatches = response.body?.matches || [];
        const fieldErrors = validateFootballDataFields(rawMatches);
        const rows = await adapter.fetchNormalizedLiveMatches();
        result.adapters[name] = {
          status: fieldErrors.length ? "error" : "ok",
          rows: rows.length,
          rawMatchCount: rawMatches.length,
          fieldErrors,
          providerId: adapter.id,
          fromCache: response.meta?.fromCache ?? false,
        };
      } else if (name === "odds") {
        let response = null;
        try {
          response = await adapter.fetchRawOddsResponse({ bypassCache: false });
        } catch (error) {
          result.adapters[name] = {
            status: "error",
            message: error.message,
            quota: adapter.getLastFetchMeta()?.quota || null,
          };
          continue;
        }
        const rows = await adapter.fetchNormalizedOddsBoard();
        result.adapters[name] = {
          status: "ok",
          rows: rows.length,
          quota: response.meta?.quota || adapter.getLastFetchMeta()?.quota || null,
          coverage: summarizeOddsCoverage(response.body),
          fromCache: response.meta?.fromCache ?? false,
        };
      } else if (name === "polymarket") {
        const response = await adapter.fetchRawEventsResponse({ bypassCache: false });
        const rows = await adapter.fetchNormalizedPredictionMarkets();
        result.adapters[name] = {
          status: "ok",
          rows: rows.length,
          sentimentOnly: true,
          directEVEligible: false,
          fromCache: response.meta?.fromCache ?? false,
        };
      } else if (name === "bzzoiro") {
        const payload = await adapter.fetchSupplementalSignals();
        result.adapters[name] = {
          status: "ok",
          events: payload.events.length,
          predictions: payload.predictions.length,
          bookmakerOddsEvents: payload.bookmakerOddsByEvent.length,
          polymarketOddsEvents: payload.polymarketOddsByEvent.length,
          warnings: payload.warnings,
        };
      } else if (name === "opinions") {
        const rows = await adapter.fetchOpinions();
        result.adapters[name] = { status: "ok", rows: rows.length };
      }
    } catch (error) {
      result.adapters[name] = { status: "error", message: error.message };
    }
  }

  const mockProvider = getMockProvider();
  const mockBoard = mockProvider.getRawMarketBoard();
  let marketBundle = { mode: "error" };
  let staticPageData = { liveMode: "error" };
  let providerStatus = null;
  let marketBundleError = null;

  try {
    marketBundle = await getMarketDataBundle();
    staticPageData = await getStaticPageData();
    providerStatus = await getProviderStatus();
  } catch (error) {
    marketBundleError = error.message;
    try {
      staticPageData = await getStaticPageData();
    } catch {
      staticPageData = { liveMode: "error" };
    }
    providerStatus = {
      appMode: providerConfig.appMode,
      marketDataMode: "error",
      requestedMarketDataMode: providerConfig.marketDataMode,
      requestedLiveDataMode: providerConfig.liveDataMode,
      marketBundleError,
    };
  }
  const jingcaiFeedCheck = {
    status: "skipped",
    mode: providerConfig.jingcaiOfficialFeedMode,
    sourceType: providerStatus.jingcaiOfficialFeedSource || null,
    feedFile: providerConfig.jingcaiOfficialFeedFile,
    feedUrl: providerConfig.jingcaiOfficialFeedUrl || null,
  };

  if (
    providerConfig.jingcaiOfficialFeedMode === "webapi" ||
    (providerConfig.jingcaiOfficialFeedMode === "real" && providerConfig.jingcaiOfficialFeedUrl)
  ) {
    try {
      const loaded = await loadJingcaiOfficialFeed({
        mode: providerConfig.jingcaiOfficialFeedMode,
        feedFile: providerConfig.jingcaiOfficialFeedFile,
        feedUrl: providerConfig.jingcaiOfficialFeedUrl,
        clientCode: providerConfig.jingcaiWebApiClientCode,
        leagueFilter: providerConfig.jingcaiWebApiLeagueFilter,
        baselineFile: providerConfig.jingcaiWebApiBaselineFile,
        alignBaselineTeams: providerConfig.jingcaiWebApiAlignBaselineTeams,
      });
      jingcaiFeedCheck.status = "ok";
      jingcaiFeedCheck.sourceType = loaded.sourceType;
      jingcaiFeedCheck.rows = loaded.feed.length;
      jingcaiFeedCheck.envelope = loaded.envelope || null;
    } catch (error) {
      jingcaiFeedCheck.status = "error";
      jingcaiFeedCheck.message = error.message;
    }
  } else if (providerConfig.jingcaiOfficialFeedMode === "real") {
    jingcaiFeedCheck.status = "skipped";
    jingcaiFeedCheck.reason = "JINGCAI_OFFICIAL_FEED_URL not configured";
  } else {
    try {
      const loaded = await loadJingcaiOfficialFeed({
        mode: providerConfig.jingcaiOfficialFeedMode,
        feedFile: providerConfig.jingcaiOfficialFeedFile,
      });
      jingcaiFeedCheck.status = "ok";
      jingcaiFeedCheck.sourceType = loaded.sourceType;
      jingcaiFeedCheck.rows = loaded.feed.length;
      jingcaiFeedCheck.envelope = loaded.envelope || null;
    } catch (error) {
      jingcaiFeedCheck.status = "error";
      jingcaiFeedCheck.message = error.message;
    }
  }

  const latestDir = path.join(projectRoot, "fixtures", "snapshots", "latest");
  const expectedSnapshotFiles = [
    "live-data.json",
    "provider-status.json",
    "jingcai-official-feed.json",
    "raw/football-data-matches.json",
    "raw/the-odds-api-h2h.json",
  ];

  for (const fileName of expectedSnapshotFiles) {
    const absolutePath = path.join(latestDir, fileName);
    result.snapshotPaths[fileName] = existsSync(absolutePath) ? "present" : "missing";
  }

  result.abContract = {
    liveData: [],
    providerStatus: [],
    oddsRaw: [],
    jingcaiAlignment: [],
  };

  try {
    if (result.snapshotPaths["live-data.json"] === "present") {
      const liveSnapshot = JSON.parse(
        readFileSync(path.join(latestDir, "live-data.json"), "utf-8"),
      );
      result.abContract.liveData = validateAbLiveDataSnapshot(liveSnapshot);
    }
    if (result.snapshotPaths["provider-status.json"] === "present") {
      const providerSnapshot = JSON.parse(
        readFileSync(path.join(latestDir, "provider-status.json"), "utf-8"),
      );
      result.abContract.providerStatus = validateAbProviderStatusSnapshot(providerSnapshot);
      result.sourceMode = providerSnapshot.sourceMode || null;
      if (providerSnapshot.fallbackUsed) {
        result.fallbackUsed = providerSnapshot.fallbackUsed;
      }
    }
    if (result.snapshotPaths["raw/the-odds-api-h2h.json"] === "present") {
      const oddsSnapshot = JSON.parse(
        readFileSync(path.join(latestDir, "raw/the-odds-api-h2h.json"), "utf-8"),
      );
      result.abContract.oddsRaw = validateAbOddsRawSnapshot(oddsSnapshot);
      const oddsEventIds = new Set(
        (oddsSnapshot.body || oddsSnapshot.payload || []).map((event) => String(event.id)),
      );
      if (jingcaiFeedCheck.rows && jingcaiFeedCheck.envelope?.matches) {
        const jingcaiIds = jingcaiFeedCheck.envelope.matches.map((m) => String(m.fixtureId));
        const unmatched = jingcaiIds.filter((id) => !oddsEventIds.has(id));
        if (unmatched.length) {
          result.abContract.jingcaiAlignment.push(
            `竞彩 fixtureId 未在 odds 快照中找到: ${unmatched.join(", ")}`,
          );
        }
      } else if (jingcaiFeedCheck.status === "ok" && jingcaiFeedCheck.rows) {
        const loaded = await loadJingcaiOfficialFeed({
          mode: providerConfig.jingcaiOfficialFeedMode,
          feedFile: providerConfig.jingcaiOfficialFeedFile,
        });
        const jingcaiIds = loaded.feed.map((m) => String(m.fixtureId));
        const unmatched = jingcaiIds.filter((id) => !oddsEventIds.has(id));
        if (unmatched.length) {
          result.abContract.jingcaiAlignment.push(
            `竞彩 fixtureId 未在 odds 快照中找到: ${unmatched.join(", ")}`,
          );
        }
      }
    }
  } catch (error) {
    result.abContract.error = error.message;
  }

  const abContractIssues = [
    ...result.abContract.liveData,
    ...result.abContract.providerStatus,
    ...result.abContract.oddsRaw,
    ...result.abContract.jingcaiAlignment,
  ];
  result.abContract.ok = abContractIssues.length === 0 && !result.abContract.error;

  result.mockValidation = validateRawMarketBoard(mockBoard);
  result.currentModes = {
    market: marketBundle.mode,
    live: staticPageData.liveMode,
  };
  result.marketBundleError = marketBundleError;
  result.providerStatus = providerStatus;
  result.jingcaiOfficialFeed = jingcaiFeedCheck;
  result.mockMergeCount = mergeMarketSources({
    oddsBoard: [],
    predictionBoard: [],
  }).length;
  result.researchGuardrails = buildResearchGuardrails(
    providerConfig,
    providerStatus,
    staticPageData,
  );
  result.fallbackUsed = result.fallbackUsed || {
    market: String(providerStatus?.marketDataMode || "").includes("fallback"),
    live: String(staticPageData.liveMode || "").includes("fallback"),
  };
  result.snapshotReplayUsed = providerStatus?.marketDataMode === "real_snapshot_replay";
  result.liveSnapshotReplayUsed = staticPageData.liveMode === "real_snapshot_replay";
  result.marketMode = providerStatus?.marketDataMode || marketBundle.mode;

  const adapterErrors = Object.values(result.adapters).filter((entry) => entry.status === "error");
  const hasResearchViolations = result.researchGuardrails.length > 0;
  const oddsReplayAvailable = result.snapshotPaths["raw/the-odds-api-h2h.json"] === "present";
  const oddsQuotaExhausted = result.adapters.odds?.status === "error" &&
    /OUT_OF_USAGE_CREDITS|Usage quota has been reached|HTTP 401/.test(result.adapters.odds?.message || "");

  const liveReplayAvailable = result.snapshotPaths["raw/football-data-matches.json"] === "present";
  const liveFetchFailed = result.adapters.live?.status === "error";

  result.ok =
    jingcaiFeedCheck.status === "ok" &&
    !hasResearchViolations &&
    result.marketMode !== "error" &&
    staticPageData.liveMode !== "error" &&
    result.abContract.ok !== false &&
    (adapterErrors.length === 0 ||
      (oddsQuotaExhausted && oddsReplayAvailable && (result.snapshotReplayUsed || result.marketMode === "real")) ||
      (liveFetchFailed && liveReplayAvailable && result.liveSnapshotReplayUsed));

  console.log(JSON.stringify(result, null, 2));

  if (!result.ok) {
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
