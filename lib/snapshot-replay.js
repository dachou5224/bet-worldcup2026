import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { projectRoot } from "./paths.js";
import { mergeMarketSources } from "../services/market-board-service.js";
import { createTheOddsApiProviderAdapter } from "../providers/odds/the-odds-api.js";
import { createFootballDataLiveProviderAdapter } from "../providers/live/football-data.js";

const DEFAULT_ODDS_SNAPSHOT_FILE = "fixtures/snapshots/latest/raw/the-odds-api-h2h.json";
const DEFAULT_LIVE_SNAPSHOT_FILE = "fixtures/snapshots/latest/live-data.json";
const DEFAULT_LIVE_RAW_SNAPSHOT_FILE = "fixtures/snapshots/latest/raw/football-data-matches.json";

function resolveSnapshotPath(filePath) {
  return path.isAbsolute(filePath) ? filePath : path.resolve(projectRoot, filePath);
}

function readWrappedSnapshotPayload(filePath) {
  const absolutePath = resolveSnapshotPath(filePath);
  if (!existsSync(absolutePath)) {
    return null;
  }

  const raw = JSON.parse(readFileSync(absolutePath, "utf-8"));
  if (Array.isArray(raw)) {
    return raw;
  }

  if (raw && typeof raw === "object" && "payload" in raw) {
    return raw.payload;
  }

  return raw;
}

export async function tryReplayLiveFromSnapshot(config, options = {}) {
  const replayFile =
    options.replayFile ||
    process.env.LIVE_SNAPSHOT_REPLAY_FILE ||
    config.liveSnapshotReplayFile ||
    DEFAULT_LIVE_SNAPSHOT_FILE;
  const payload = readWrappedSnapshotPayload(replayFile);
  const normalizedLiveMatches =
    payload?.liveData?.liveMatches ||
    payload?.payload?.liveMatches ||
    payload?.liveMatches ||
    null;

  if (Array.isArray(normalizedLiveMatches) && normalizedLiveMatches.length) {
    return {
      liveMatches: normalizedLiveMatches,
      liveMode: "real_snapshot_replay",
      liveSnapshotFile: resolveSnapshotPath(replayFile),
      liveSnapshotSource: "normalized_live_snapshot",
      liveReplayReason: options.reason || "live fetch failed",
      liveMatchCount: normalizedLiveMatches.length,
    };
  }

  const matches = payload?.matches;
  if (Array.isArray(matches) && matches.length) {
    const adapter = createFootballDataLiveProviderAdapter(config);
    const originalFetch = adapter.fetchRawMatches.bind(adapter);
    adapter.fetchRawMatches = async () => ({ matches });

    try {
      const liveMatches = await adapter.fetchNormalizedLiveMatches();
      return {
        liveMatches,
        liveMode: "real_snapshot_replay",
        liveSnapshotFile: resolveSnapshotPath(replayFile),
        liveSnapshotSource: "raw_live_snapshot",
        liveReplayReason: options.reason || "live fetch failed",
        liveMatchCount: liveMatches.length,
      };
    } finally {
      adapter.fetchRawMatches = originalFetch;
    }
  }

  if (replayFile !== DEFAULT_LIVE_RAW_SNAPSHOT_FILE) {
    return tryReplayLiveFromSnapshot(config, {
      ...options,
      replayFile: options.rawReplayFile || process.env.LIVE_RAW_SNAPSHOT_REPLAY_FILE || DEFAULT_LIVE_RAW_SNAPSHOT_FILE,
    });
  }

  return null;
}

export function readOddsSnapshotPayload(filePath = DEFAULT_ODDS_SNAPSHOT_FILE) {
  const absolutePath = resolveSnapshotPath(filePath);

  if (!existsSync(absolutePath)) {
    return null;
  }

  const raw = JSON.parse(readFileSync(absolutePath, "utf-8"));
  if (Array.isArray(raw)) {
    return {
      payload: raw,
      meta: {
        capturedAt: null,
        source: "the-odds-api",
        sourceMode: "real_snapshot_replay",
      },
    };
  }

  if (raw && typeof raw === "object" && Array.isArray(raw.payload)) {
    return {
      payload: raw.payload,
      meta: {
        capturedAt: raw.capturedAt || null,
        source: raw.source || "the-odds-api",
        sourceMode: raw.sourceMode || "real_snapshot_replay",
        rawPayloadHash: raw.rawPayloadHash || null,
        parserVersion: raw.parserVersion || null,
        quota: raw.quota || null,
        coverage: raw.coverage || null,
      },
    };
  }

  return null;
}

export async function buildOddsBoardFromSnapshot(config, filePath = DEFAULT_ODDS_SNAPSHOT_FILE) {
  const snapshot = readOddsSnapshotPayload(filePath);
  if (!snapshot) {
    return null;
  }

  const adapter = createTheOddsApiProviderAdapter(config);
  const originalFetch = adapter.fetchRawOddsBoard.bind(adapter);
  adapter.fetchRawOddsBoard = async () => snapshot.payload;

  try {
    const oddsBoard = await adapter.fetchNormalizedOddsBoard();
    return {
      oddsBoard,
      snapshotMeta: snapshot.meta,
      snapshotFile: resolveSnapshotPath(filePath),
    };
  } finally {
    adapter.fetchRawOddsBoard = originalFetch;
  }
}

export function isOddsQuotaError(error) {
  const message = error?.message || "";
  return (
    message.includes("OUT_OF_USAGE_CREDITS") ||
    message.includes("Usage quota has been reached") ||
    message.includes("HTTP 401")
  );
}

export async function tryReplayOddsFromSnapshot(config, options = {}) {
  const replayFile =
    options.replayFile ||
    process.env.ODDS_SNAPSHOT_REPLAY_FILE ||
    DEFAULT_ODDS_SNAPSHOT_FILE;

  const replay = await buildOddsBoardFromSnapshot(config, replayFile);
  if (!replay?.oddsBoard?.length) {
    return null;
  }

  return {
    mode: "real_snapshot_replay",
    oddsBoard: replay.oddsBoard,
    providerHealth: {
      oddsStatus: "snapshot_replay",
      oddsRows: replay.oddsBoard.length,
      oddsSnapshotFile: replay.snapshotFile,
      oddsSnapshotCapturedAt: replay.snapshotMeta.capturedAt,
      oddsReplayReason: options.reason || "live odds fetch failed",
      polymarketStatus: "skipped",
    },
  };
}

export function mergeReplayedMarketBundle(replayResult, predictionBoard = []) {
  const rawMarketBoard = mergeMarketSources({
    oddsBoard: replayResult.oddsBoard,
    predictionBoard,
  });

  return {
    mode: replayResult.mode,
    rawMarketBoard,
    providerHealth: {
      ...replayResult.providerHealth,
      mergedFixtureCount: rawMarketBoard.length,
    },
  };
}
