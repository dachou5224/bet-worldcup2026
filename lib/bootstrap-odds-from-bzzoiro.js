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

export { convertBzzoiroBookmakerOddsToOddsApiEvents, hasBookmakerOdds };

export function buildOddsSnapshotFromBzzoiro(options = {}) {
  const source = readLatestBzzoiroOddsSource(options.cacheDir);
  if (!source) {
    throw new Error("未找到可用的 Bzzoiro bookmaker odds 快照");
  }

  const bookmakerOddsByEvent = source.bookmakerOddsByEvent || [];
  const payload = convertBzzoiroBookmakerOddsToOddsApiEvents(bookmakerOddsByEvent);
  if (!payload.length) {
    throw new Error("Bzzoiro 数据源中没有可用的 1x2 bookmaker odds");
  }

  const capturedAt = source.cachedAt || new Date().toISOString();
  return withAbOddsRawEnvelope(
    wrapSnapshotPayload(payload, {
      capturedAt,
      source: "bzzoiro-bookmaker-odds",
      sourceMode: "file",
      parserVersion: SNAPSHOT_PARSER_VERSION,
      extra: {
        bootstrapReason: options.reason || "the-odds-api unavailable",
        bootstrapFrom: source.absolutePath,
        bootstrapMethod: "bzzoiro_to_odds_api_wire_format",
        directEVEligible: true,
        fixtureCount: payload.length,
        coverage: summarizeOddsCoverage(payload),
        requestedMarkets: ["h2h"],
        note: "非 The Odds API live 响应；由 Bzzoiro 真实 bookmaker 1x2 赔率转换而来，用于 research 回放。",
      },
    }),
    {
      sportKey: "soccer_fifa_world_cup",
      regions: options.regions || "eu",
      markets: ["h2h"],
      commenceTimeFrom: options.commenceTimeFrom || null,
      commenceTimeTo: options.commenceTimeTo || null,
      quota: null,
    },
  );
}

export function writeOddsSnapshotFromBzzoiro(outputFile, options = {}) {
  const wrapped = buildOddsSnapshotFromBzzoiro(options);
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

export function readBzzoiroCacheEntry(cacheDir = "./fixtures/cache") {
  return readLatestBzzoiroOddsSource(cacheDir);
}
