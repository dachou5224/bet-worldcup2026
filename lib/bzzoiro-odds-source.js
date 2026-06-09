import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { projectRoot } from "./paths.js";
import { hasBookmakerOdds } from "./bzzoiro-odds-normalize.js";

function readSupplementalSignalsSnapshot(filePath) {
  const absolutePath = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(projectRoot, filePath);

  if (!existsSync(absolutePath)) {
    return null;
  }

  const raw = JSON.parse(readFileSync(absolutePath, "utf-8"));
  const payload = raw.supplementalSignals || raw.payload || raw;
  const bookmakerOddsByEvent = payload.bookmakerOddsByEvent || [];

  if (!hasBookmakerOdds(bookmakerOddsByEvent)) {
    return null;
  }

  return {
    absolutePath,
    cachedAt: raw.capturedAt || payload.checkedAt || null,
    bookmakerOddsByEvent,
  };
}

function readLatestSupplementalSignalsSnapshot() {
  const snapshotsRoot = path.join(projectRoot, "fixtures", "snapshots");
  const candidates = [
    path.join(snapshotsRoot, "latest", "supplemental-signals.json"),
    path.join(snapshotsRoot, "2026-06-08", "0906", "supplemental-signals.json"),
    path.join(snapshotsRoot, "supplemental-signals.json"),
  ];

  for (const candidate of candidates) {
    const snapshot = readSupplementalSignalsSnapshot(candidate);
    if (snapshot) {
      return snapshot;
    }
  }

  return null;
}

export function readLatestBzzoiroOddsSource(cacheDir = "./fixtures/cache") {
  const absoluteDir = path.isAbsolute(cacheDir)
    ? cacheDir
    : path.resolve(projectRoot, cacheDir);

  if (existsSync(absoluteDir)) {
    const candidates = readdirSync(absoluteDir)
      .filter((fileName) => fileName.startsWith("bzzoiro-supplemental-signals-") && fileName.endsWith(".json"))
      .map((fileName) => {
        const absolutePath = path.join(absoluteDir, fileName);
        const entry = JSON.parse(readFileSync(absolutePath, "utf-8"));
        const bookmakerOddsByEvent = entry.payload?.bookmakerOddsByEvent || [];
        return {
          absolutePath,
          cachedAt: entry.cachedAt || null,
          bookmakerOddsByEvent,
        };
      })
      .filter((entry) => hasBookmakerOdds(entry.bookmakerOddsByEvent))
      .sort((left, right) => String(right.cachedAt).localeCompare(String(left.cachedAt)));

    if (candidates[0]) {
      return candidates[0];
    }
  }

  return readLatestSupplementalSignalsSnapshot();
}
