import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { projectRoot } from "./paths.js";

export const SNAPSHOT_PARSER_VERSION = "2026.06.08-agent-b";

export function computePayloadHash(payload) {
  const serialized = typeof payload === "string" ? payload : JSON.stringify(payload);
  return createHash("sha256").update(serialized).digest("hex");
}

export function wrapSnapshotPayload(payload, meta = {}) {
  const capturedAt = meta.capturedAt || new Date().toISOString();
  return {
    capturedAt,
    source: meta.source || "unknown",
    sourceMode: meta.sourceMode || "real",
    rawPayloadHash: meta.rawPayloadHash || computePayloadHash(payload),
    parserVersion: meta.parserVersion || SNAPSHOT_PARSER_VERSION,
    ...meta.extra,
    payload,
  };
}

function formatTimestampParts(capturedAt) {
  const date = new Date(capturedAt);
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const min = String(date.getUTCMinutes()).padStart(2, "0");
  return { dateKey: `${yyyy}-${mm}-${dd}`, timeKey: `${hh}${min}` };
}

export function resolveSnapshotDirs(capturedAt = new Date().toISOString(), variant = null) {
  const { dateKey, timeKey } = formatTimestampParts(capturedAt);
  const snapshotsRoot = path.join(projectRoot, "fixtures", "snapshots");
  const latestDir = path.join(snapshotsRoot, "latest");
  const rawDir = path.join(latestDir, "raw");
  const versionedDir = variant
    ? path.join(snapshotsRoot, dateKey, variant)
    : path.join(snapshotsRoot, dateKey, timeKey);

  return {
    snapshotsRoot,
    latestDir,
    rawDir,
    versionedDir,
    flatDir: snapshotsRoot,
  };
}

export function writeJsonSnapshot(filePath, payload) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

export function writeSnapshotToTargets({ fileName, payload, capturedAt, dirs }) {
  const targets = [
    path.join(dirs.latestDir, fileName),
    path.join(dirs.versionedDir, fileName),
    path.join(dirs.flatDir, fileName),
  ];

  for (const target of targets) {
    writeJsonSnapshot(target, payload);
  }

  return targets;
}

export function extractOddsQuotaHeaders(headers = {}) {
  const normalized = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]),
  );

  return {
    requestsRemaining: normalized["x-requests-remaining"] ?? null,
    requestsUsed: normalized["x-requests-used"] ?? null,
    requestsLast: normalized["x-requests-last"] ?? null,
  };
}

export function summarizeOddsCoverage(rawEvents = [], staleThresholdMinutes = 120) {
  const now = Date.now();
  const staleCutoffMs = staleThresholdMinutes * 60 * 1000;
  const bookmakers = new Set();
  let staleOddsCount = 0;

  for (const event of rawEvents) {
    for (const bookmaker of event.bookmakers || []) {
      bookmakers.add(bookmaker.key || bookmaker.title || "unknown");
      const lastUpdate = bookmaker.last_update ? new Date(bookmaker.last_update).getTime() : NaN;
      if (!Number.isNaN(lastUpdate) && now - lastUpdate > staleCutoffMs) {
        staleOddsCount += 1;
      }
    }
  }

  return {
    fixtureCount: rawEvents.length,
    bookmakerDiversity: bookmakers.size,
    bookmakers: Array.from(bookmakers).sort(),
    staleOddsCount,
    staleThresholdMinutes,
  };
}
