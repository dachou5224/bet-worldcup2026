import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { projectRoot } from "./paths.js";

function resolveArtifactPath(filePath, baseDir = "fixtures/snapshots") {
  if (path.isAbsolute(filePath)) {
    return filePath;
  }

  if (filePath.startsWith("./") || filePath.startsWith("../")) {
    return path.resolve(projectRoot, filePath);
  }

  return path.resolve(projectRoot, baseDir, filePath);
}

function readJsonFile(filePath) {
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

function writeJsonFile(filePath, payload) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

export function readPostMatchReviewArtifact(postMatchReviewFile, baseDir = "fixtures/snapshots") {
  const payload = readJsonFile(resolveArtifactPath(postMatchReviewFile, baseDir));
  if (Array.isArray(payload)) {
    return payload;
  }

  if (payload && Array.isArray(payload.completedComparisons)) {
    return payload.completedComparisons;
  }

  if (payload && Array.isArray(payload.postMatchReview)) {
    return payload.postMatchReview;
  }

  return null;
}

export function writePostMatchReviewArtifact(postMatchReview, postMatchReviewFile, baseDir = "fixtures/snapshots") {
  const filePath = resolveArtifactPath(postMatchReviewFile, baseDir);
  writeJsonFile(filePath, {
    capturedAt: new Date().toISOString(),
    completedComparisons: postMatchReview,
  });
  return filePath;
}
