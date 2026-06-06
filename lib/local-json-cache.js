import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { projectRoot } from "./paths.js";

function sanitizeSegment(value) {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/-+/g, "-");
}

function resolveCacheDir(cacheDir) {
  if (path.isAbsolute(cacheDir)) {
    return cacheDir;
  }

  return path.resolve(projectRoot, cacheDir);
}

function buildCacheFilePath({ namespace, cacheKey, cacheDir }) {
  const digest = createHash("sha1").update(cacheKey).digest("hex");
  const fileName = `${sanitizeSegment(namespace)}-${digest}.json`;
  return path.join(resolveCacheDir(cacheDir), fileName);
}

function readCacheEntry(filePath) {
  if (!existsSync(filePath)) {
    return null;
  }

  const raw = readFileSync(filePath, "utf-8");
  const entry = JSON.parse(raw);
  return entry && typeof entry === "object" ? entry : null;
}

function isFresh(entry, ttlSeconds) {
  if (!entry?.cachedAt || ttlSeconds <= 0) {
    return false;
  }

  const cachedAtMs = new Date(entry.cachedAt).getTime();
  if (Number.isNaN(cachedAtMs)) {
    return false;
  }

  return Date.now() - cachedAtMs < ttlSeconds * 1000;
}

function writeCacheEntry(filePath, entry) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(entry, null, 2));
}

export async function getCachedJsonPayload({
  namespace,
  cacheKey,
  ttlSeconds,
  fetcher,
  enabled = true,
  cacheDir = "fixtures/cache",
}) {
  if (!enabled) {
    return fetcher();
  }

  const filePath = buildCacheFilePath({ namespace, cacheKey, cacheDir });
  const entry = readCacheEntry(filePath);
  if (entry && isFresh(entry, ttlSeconds)) {
    return entry.payload;
  }

  const payload = await fetcher();
  writeCacheEntry(filePath, {
    namespace,
    cacheKey,
    cachedAt: new Date().toISOString(),
    ttlSeconds,
    payload,
  });
  return payload;
}
