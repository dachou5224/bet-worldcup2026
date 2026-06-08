import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchJson } from "../../lib/fetch-json.js";
import { validateJingcaiOfficialFeed } from "../../schemas/jingcai-official-feed.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolveFeedPath(feedFile) {
  return path.isAbsolute(feedFile) ? feedFile : path.resolve(__dirname, "../../", feedFile);
}

function readJsonFeed(feedFile) {
  const absolutePath = resolveFeedPath(feedFile);

  if (!existsSync(absolutePath)) {
    throw new Error(`Jingcai 官方盘文件不存在: ${absolutePath}`);
  }

  return JSON.parse(readFileSync(absolutePath, "utf-8"));
}

async function readJsonFeedFromUrl(feedUrl) {
  if (!feedUrl) {
    throw new Error("Jingcai 官方盘 URL 未配置");
  }

  const response = await fetchJson(feedUrl, { timeoutMs: 20000 });
  return response.body;
}

function resolveSourceType(mode, feedFile, feedUrl) {
  if (mode === "real") {
    return feedUrl ? "url" : "file";
  }

  if (mode === "file") {
    return "file";
  }

  return "fixture";
}

export async function getMockJingcaiOfficialFeed() {
  const loaded = await loadJingcaiOfficialFeed("fixtures/jingcai-official-feed.json");
  return loaded.feed;
}

export async function loadJingcaiOfficialFeed(source, options = {}) {
  const normalizedSource =
    typeof source === "string"
      ? { feedFile: source, ...options }
      : source && typeof source === "object"
        ? source
        : {};
  const mode = normalizedSource.mode || "fixture";
  const feedFile = normalizedSource.feedFile || "fixtures/jingcai-official-feed.json";
  const feedUrl = normalizedSource.feedUrl || "";
  const sourceType = resolveSourceType(mode, feedFile, feedUrl);
  const feed =
    mode === "real" && feedUrl
      ? await readJsonFeedFromUrl(feedUrl)
      : readJsonFeed(feedFile);
  const validation = validateJingcaiOfficialFeed(feed);

  if (!validation.ok) {
    throw new Error(`Jingcai 官方盘文件不合法: ${validation.errors.join("; ")}`);
  }

  return {
    mode,
    sourceType,
    feedFile,
    feedUrl: feedUrl || null,
    feed,
  };
}

export async function getJingcaiOfficialFeed(source = "fixtures/jingcai-official-feed.json") {
  const loaded = await loadJingcaiOfficialFeed(source);
  return loaded.feed;
}

export function findJingcaiOfficialMatch(feed, fixtureId) {
  const numericFixtureId = typeof fixtureId === "number" ? fixtureId : Number(fixtureId);
  return (feed || []).find((record) => record.fixtureId === numericFixtureId) || null;
}

export function getPlayMarketOdds(record, playType) {
  if (!record) {
    return null;
  }

  if (playType === "胜平负") {
    return record.availablePlays?.spf || null;
  }

  if (playType === "让球胜平负") {
    return record.availablePlays?.rqspf || null;
  }

  return null;
}
