import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function readJsonFixture(relativePath) {
  const absolutePath = path.resolve(__dirname, "../../", relativePath);
  return JSON.parse(readFileSync(absolutePath, "utf-8"));
}

export function getMockJingcaiOfficialFeed() {
  return readJsonFixture("fixtures/jingcai-official-feed.json");
}

export function getJingcaiOfficialFeed() {
  return getMockJingcaiOfficialFeed();
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
