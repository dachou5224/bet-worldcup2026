import path from "node:path";
import { projectRoot } from "./paths.js";
import {
  convertBzzoiroBookmakerOddsToOddsApiEvents,
  hasBookmakerOdds,
} from "./bzzoiro-odds-normalize.js";
import { readLatestBzzoiroOddsSource } from "./bzzoiro-odds-source.js";
import {
  SNAPSHOT_PARSER_VERSION,
  wrapSnapshotPayload,
  summarizeOddsCoverage,
  writeJsonSnapshot,
} from "./snapshot-store.js";
import { withAbOddsRawEnvelope } from "./snapshot-ab-contract.js";
import { fetchLiveBookmakerOddsByEvent } from "../providers/odds/bzzoiro-odds.js";

export { convertBzzoiroBookmakerOddsToOddsApiEvents, hasBookmakerOdds };

function buildOddsSnapshotEnvelope(bookmakerOddsByEvent, { capturedAt, source, sourceMode, extra = {} }) {
  const payload = convertBzzoiroBookmakerOddsToOddsApiEvents(bookmakerOddsByEvent);
  if (!payload.length) {
    throw new Error("Bzzoiro 数据源中没有可用的 1x2 bookmaker odds");
  }

  return withAbOddsRawEnvelope(
    wrapSnapshotPayload(payload, {
      capturedAt,
      source,
      sourceMode,
      parserVersion: SNAPSHOT_PARSER_VERSION,
      extra: {
        directEVEligible: true,
        fixtureCount: payload.length,
        coverage: summarizeOddsCoverage(payload),
        requestedMarkets: ["h2h"],
        note: "非 The Odds API live 响应；由 Bzzoiro 真实 bookmaker 1x2 赔率转换而来，用于 research 回放。",
        ...extra,
      },
    }),
    {
      sportKey: "soccer_fifa_world_cup",
      regions: extra.regions || "eu",
      markets: ["h2h"],
      commenceTimeFrom: extra.commenceTimeFrom || null,
      commenceTimeTo: extra.commenceTimeTo || null,
      quota: null,
    },
  );
}

export function buildOddsSnapshotFromBzzoiro(options = {}) {
  const source = readLatestBzzoiroOddsSource(options.cacheDir);
  if (!source) {
    throw new Error("未找到可用的 Bzzoiro bookmaker odds 快照");
  }

  const bookmakerOddsByEvent = source.bookmakerOddsByEvent || [];
  return buildOddsSnapshotEnvelope(bookmakerOddsByEvent, {
    capturedAt: source.cachedAt || new Date().toISOString(),
    source: "bzzoiro-bookmaker-odds",
    sourceMode: "file",
    extra: {
      bootstrapReason: options.reason || "the-odds-api unavailable",
      bootstrapFrom: source.absolutePath,
      bootstrapMethod: "bzzoiro_to_odds_api_wire_format",
    },
  });
}

export async function buildOddsSnapshotFromLiveBzzoiro(config, options = {}) {
  if (!config?.bzzoiroApiToken) {
    throw new Error("Bzzoiro API token 未配置，无法 live 拉取 bookmaker odds");
  }

  const bookmakerOddsByEvent = await fetchLiveBookmakerOddsByEvent(config);
  if (!hasBookmakerOdds(bookmakerOddsByEvent)) {
    throw new Error("Bzzoiro live odds 返回空结果");
  }

  return buildOddsSnapshotEnvelope(bookmakerOddsByEvent, {
    capturedAt: new Date().toISOString(),
    source: "bzzoiro-bookmaker-odds",
    sourceMode: "real",
    extra: {
      bootstrapReason: options.reason || "live bzzoiro fetch",
      bootstrapMethod: "bzzoiro_live_to_odds_api_wire_format",
    },
  });
}

function writeOddsSnapshotEnvelope(outputFile, wrapped) {
  const absolutePath = path.isAbsolute(outputFile)
    ? outputFile
    : path.resolve(projectRoot, outputFile);

  writeJsonSnapshot(absolutePath, wrapped);
  return {
    outputFile: absolutePath,
    fixtureCount: wrapped.payload.length,
    rawPayloadHash: wrapped.rawPayloadHash,
    capturedAt: wrapped.capturedAt,
  };
}

export function writeOddsSnapshotFromBzzoiro(outputFile, options = {}) {
  return writeOddsSnapshotEnvelope(outputFile, buildOddsSnapshotFromBzzoiro(options));
}

export async function writeOddsSnapshotFromLiveBzzoiro(outputFile, config, options = {}) {
  const wrapped = await buildOddsSnapshotFromLiveBzzoiro(config, options);
  return writeOddsSnapshotEnvelope(outputFile, wrapped);
}

export function readBzzoiroCacheEntry(cacheDir = "./fixtures/cache") {
  return readLatestBzzoiroOddsSource(cacheDir);
}
