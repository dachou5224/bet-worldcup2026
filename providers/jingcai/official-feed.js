import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
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

export function getMockJingcaiOfficialFeed() {
  return loadJingcaiOfficialFeed("fixtures/jingcai-official-feed.json");
}

export function loadJingcaiOfficialFeed(feedFile) {
  const feed = readJsonFeed(feedFile);
  const validation = validateJingcaiOfficialFeed(feed);

  if (!validation.ok) {
    throw new Error(`Jingcai 官方盘文件不合法: ${validation.errors.join("; ")}`);
  }

  return feed;
}

export function getJingcaiOfficialFeed(feedFile = "fixtures/jingcai-official-feed.json") {
  return loadJingcaiOfficialFeed(feedFile);
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
