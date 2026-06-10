import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchJson } from "../../lib/fetch-json.js";
import { validateJingcaiOfficialFeed } from "../../schemas/jingcai-official-feed.js";
import {
  fetchSportteryFootballMatchList,
  flattenSportteryMatchList,
} from "../../lib/sporttery-webapi.js";
import {
  filterSportteryMatches,
  normalizeSportteryPayloadToFeedEnvelope,
} from "../../lib/sporttery-webapi-normalize.js";
import { buildMatchKey } from "../../lib/jingcai-gemini-draft.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolveFeedPath(feedFile) {
  return path.isAbsolute(feedFile) ? feedFile : path.resolve(__dirname, "../../", feedFile);
}

function normalizeFeedRecords(feed) {
  if (Array.isArray(feed)) {
    return feed;
  }

  if (feed && typeof feed === "object" && Array.isArray(feed.matches)) {
    return feed.matches;
  }

  return feed;
}

function extractFeedEnvelope(feed) {
  if (feed && typeof feed === "object" && !Array.isArray(feed) && Array.isArray(feed.matches)) {
    return {
      capturedAt: feed.capturedAt || null,
      source: feed.source || null,
      sourceUrl: feed.sourceUrl || null,
      manualReviewed: feed.manualReviewed ?? null,
    };
  }

  return null;
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
  if (mode === "webapi") {
    return "webapi";
  }

  if (mode === "real") {
    return feedUrl ? "url" : "file";
  }

  if (mode === "file") {
    return "file";
  }

  return "fixture";
}

async function readJsonFeedFromWebapi(options = {}) {
  const fetched = await fetchSportteryFootballMatchList({
    clientCode: options.clientCode,
    timeoutMs: options.timeoutMs,
  });
  const allMatches = flattenSportteryMatchList(fetched.body);
  const baselineEnvelope = options.baselineFile ? readJsonFeed(options.baselineFile) : null;
  const baselineMatches = baselineEnvelope?.matches || [];
  const filteredMatches = filterSportteryMatches(allMatches, {
    leagueName: options.leagueFilter,
    teamNames: options.teamFilter || [],
  });

  if (options.alignBaselineTeams && baselineMatches.length) {
    const baselineKeys = new Set(
      baselineMatches.map((match) => buildMatchKey(match.homeTeam, match.awayTeam)),
    );
    const narrowed = filteredMatches.filter((match) =>
      baselineKeys.has(buildMatchKey(match.homeTeamAllName, match.awayTeamAllName)),
    );
    if (narrowed.length) {
      filteredMatches.length = 0;
      filteredMatches.push(...narrowed);
    }
  }

  return normalizeSportteryPayloadToFeedEnvelope(fetched.body, {
    capturedAt: fetched.capturedAt,
    matches: filteredMatches,
    baselineMatches,
    clientCode: options.clientCode,
  });
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
    mode === "webapi"
      ? await readJsonFeedFromWebapi({
          clientCode: normalizedSource.clientCode,
          leagueFilter: normalizedSource.leagueFilter,
          teamFilter: normalizedSource.teamFilter,
          baselineFile: normalizedSource.baselineFile,
          alignBaselineTeams: normalizedSource.alignBaselineTeams,
          timeoutMs: normalizedSource.timeoutMs,
        })
      : mode === "real" && feedUrl
        ? await readJsonFeedFromUrl(feedUrl)
        : readJsonFeed(feedFile);
  const feedEnvelope =
    feed && typeof feed === "object" && !Array.isArray(feed) && Array.isArray(feed.matches)
      ? feed
      : extractFeedEnvelope(feed);
  const records = normalizeFeedRecords(feed);
  const validation = validateJingcaiOfficialFeed(records);

  if (!validation.ok) {
    throw new Error(`Jingcai 官方盘文件不合法: ${validation.errors.join("; ")}`);
  }

  return {
    mode,
    sourceType,
    feedFile,
    feedUrl: feedUrl || null,
    feed: records,
    envelope: feedEnvelope,
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
