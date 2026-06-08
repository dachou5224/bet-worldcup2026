import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { projectRoot } from "./paths.js";

function resolveSnapshotsDir(baseDir = "fixtures/snapshots") {
  return path.isAbsolute(baseDir) ? baseDir : path.resolve(projectRoot, baseDir);
}

function resolveArtifactPath(fileName, baseDir = "fixtures/snapshots") {
  return path.join(resolveSnapshotsDir(baseDir), fileName);
}

function readJsonFile(filePath) {
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const payload = JSON.parse(readFileSync(filePath, "utf-8"));
    return payload && typeof payload === "object" ? payload : null;
  } catch {
    return null;
  }
}

function writeJsonFile(filePath, payload) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

export function readRecommendationSnapshotsArtifact(baseDir = "fixtures/snapshots") {
  const payload = readJsonFile(resolveArtifactPath("recommendation-snapshots.json", baseDir));
  return payload?.recommendationSnapshots || [];
}

export function readRecommendationSnapshotSummaryArtifact(baseDir = "fixtures/snapshots") {
  const payload = readJsonFile(resolveArtifactPath("recommendation-snapshots.json", baseDir));
  return payload?.recommendationSnapshotSummary || null;
}

export function readRecommendationSettlementsArtifact(baseDir = "fixtures/snapshots") {
  const payload = readJsonFile(resolveArtifactPath("recommendation-settlements.json", baseDir));
  return payload?.recommendationSettlements || [];
}

export function readRecommendationSettlementSummaryArtifact(baseDir = "fixtures/snapshots") {
  const payload = readJsonFile(resolveArtifactPath("recommendation-settlements.json", baseDir));
  return payload?.recommendationSettlementSummary || null;
}

export function writeRecommendationSnapshotsArtifact(payload, baseDir = "fixtures/snapshots") {
  const filePath = resolveArtifactPath("recommendation-snapshots.json", baseDir);
  writeJsonFile(filePath, payload);
  return filePath;
}

export function writeRecommendationSettlementsArtifact(payload, baseDir = "fixtures/snapshots") {
  const filePath = resolveArtifactPath("recommendation-settlements.json", baseDir);
  writeJsonFile(filePath, payload);
  return filePath;
}
