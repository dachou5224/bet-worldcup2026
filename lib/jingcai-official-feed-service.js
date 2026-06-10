import { getCachedJsonPayload } from "./local-json-cache.js";
import { resolveJingcaiOfficialFeedMode } from "./jingcai-feed-mode.js";
import { loadJingcaiOfficialFeed } from "../providers/jingcai/official-feed.js";

let lastJingcaiLoadMeta = null;

export function getLastJingcaiLoadMeta() {
  return lastJingcaiLoadMeta;
}

function buildLoadOptions(config, mode) {
  return {
    mode,
    feedFile: config.jingcaiOfficialFeedFile,
    feedUrl: config.jingcaiOfficialFeedUrl,
    clientCode: config.jingcaiWebApiClientCode,
    leagueFilter: config.jingcaiWebApiLeagueFilter,
    baselineFile: config.jingcaiWebApiBaselineFile,
    alignBaselineTeams: config.jingcaiWebApiAlignBaselineTeams,
  };
}

function buildLoadMeta(loaded, { requestedMode, effectiveMode, fallbackUsed = false, fallbackReason = null, fromCache = false }) {
  return {
    requestedMode,
    effectiveMode,
    sourceType: loaded.sourceType,
    fallbackUsed,
    fallbackReason,
    fromCache,
    matchCount: loaded.feed.length,
    capturedAt: loaded.envelope?.capturedAt || null,
    source: loaded.envelope?.source || null,
  };
}

async function loadFromFileSnapshot(config, { requestedMode = "webapi", fallbackReason = null } = {}) {
  const loaded = await loadJingcaiOfficialFeed(buildLoadOptions(config, "file"));
  lastJingcaiLoadMeta = buildLoadMeta(loaded, {
    requestedMode,
    effectiveMode: "file",
    fallbackUsed: requestedMode === "webapi",
    fallbackReason,
  });
  return { ...loaded, loadMeta: lastJingcaiLoadMeta };
}

async function fetchWebapiEnvelope(config, { bypassCache = false } = {}) {
  const cacheKey = JSON.stringify({
    clientCode: config.jingcaiWebApiClientCode,
    leagueFilter: config.jingcaiWebApiLeagueFilter,
    baselineFile: config.jingcaiWebApiBaselineFile,
    alignBaselineTeams: config.jingcaiWebApiAlignBaselineTeams,
  });

  const cachedPayload = await getCachedJsonPayload({
    namespace: "jingcai-sporttery-webapi",
    cacheKey,
    ttlSeconds: config.jingcaiWebApiCacheTtlSeconds,
    enabled: !bypassCache && config.providerCacheEnabled,
    cacheDir: config.providerCacheDir,
    fetcher: async () => {
      const loaded = await loadJingcaiOfficialFeed(buildLoadOptions(config, "webapi"));
      return {
        feed: loaded.feed,
        envelope: loaded.envelope,
        sourceType: loaded.sourceType,
        mode: loaded.mode,
        feedFile: loaded.feedFile,
        feedUrl: loaded.feedUrl,
      };
    },
  });

  const fromCache = !bypassCache && config.providerCacheEnabled;
  return {
    mode: "webapi",
    sourceType: cachedPayload.sourceType || "webapi",
    feedFile: cachedPayload.feedFile || config.jingcaiOfficialFeedFile,
    feedUrl: cachedPayload.feedUrl || null,
    feed: cachedPayload.feed,
    envelope: cachedPayload.envelope,
    fromCache,
  };
}

export async function loadJingcaiOfficialFeedBundle(config) {
  const requestedMode = resolveJingcaiOfficialFeedMode(config);

  if (requestedMode !== "webapi") {
    const loaded = await loadJingcaiOfficialFeed(buildLoadOptions(config, requestedMode));
    lastJingcaiLoadMeta = buildLoadMeta(loaded, {
      requestedMode,
      effectiveMode: requestedMode,
    });
    return { ...loaded, loadMeta: lastJingcaiLoadMeta };
  }

  try {
    const loaded = await fetchWebapiEnvelope(config);
    lastJingcaiLoadMeta = buildLoadMeta(loaded, {
      requestedMode,
      effectiveMode: "webapi",
      fromCache: loaded.fromCache,
    });
    return { ...loaded, loadMeta: lastJingcaiLoadMeta };
  } catch (error) {
    if (!config.jingcaiWebApiSnapshotFallbackEnabled) {
      lastJingcaiLoadMeta = {
        requestedMode,
        effectiveMode: "webapi",
        sourceType: "webapi",
        fallbackUsed: false,
        fallbackReason: error.message,
        fromCache: false,
        matchCount: 0,
        capturedAt: null,
        source: null,
        error: error.message,
      };
      throw error;
    }

    return loadFromFileSnapshot(config, {
      requestedMode,
      fallbackReason: error.message,
    });
  }
}
