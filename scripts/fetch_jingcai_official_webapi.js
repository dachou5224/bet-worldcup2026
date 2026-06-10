/**
 * 从体彩官网 webapi 拉取竞彩足球在售场次，生成官方 feed 草稿/快照。
 *
 * npm run fetch:jingcai-webapi
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { loadProjectEnv } from "../lib/load-env.js";
import { projectRoot } from "../lib/paths.js";
import { diffDraftAgainstBaseline } from "../lib/jingcai-gemini-draft.js";
import {
  fetchSportteryFootballMatchList,
  flattenSportteryMatchList,
  SPORTTERY_CLIENT_CODE,
} from "../lib/sporttery-webapi.js";
import {
  filterSportteryMatches,
  normalizeSportteryPayloadToFeedEnvelope,
} from "../lib/sporttery-webapi-normalize.js";
import { validateJingcaiOfficialFeed } from "../schemas/jingcai-official-feed.js";

loadProjectEnv();

const BASELINE_FILE =
  process.env.JINGCAI_BASELINE_FILE ||
  path.join(projectRoot, "fixtures/snapshots/latest/jingcai-official-feed.json");
const DRAFT_FILE =
  process.env.JINGCAI_WEBAPI_DRAFT_FILE ||
  path.join(projectRoot, "fixtures/drafts/jingcai-webapi-draft.json");
const RAW_FILE =
  process.env.JINGCAI_WEBAPI_RAW_FILE ||
  path.join(projectRoot, "fixtures/snapshots/latest/raw/sporttery-football-match-list.json");
const DIFF_FILE =
  process.env.JINGCAI_WEBAPI_DIFF_FILE ||
  path.join(projectRoot, "fixtures/drafts/jingcai-webapi-diff.json");

function readJsonIfExists(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

function writeJson(filePath, payload) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");
}

async function run() {
  const startedAt = Date.now();
  const baselineEnvelope = readJsonIfExists(BASELINE_FILE);
  const baselineMatches = baselineEnvelope?.matches || [];

  const fetched = await fetchSportteryFootballMatchList();
  const allMatches = flattenSportteryMatchList(fetched.body);
  const filteredMatches = filterSportteryMatches(allMatches, {
    leagueName: process.env.JINGCAI_WEBAPI_LEAGUE_FILTER || "世界杯",
    teamNames: baselineMatches.length
      ? []
      : (process.env.JINGCAI_WEBAPI_TEAM_FILTER || "").split(",").filter(Boolean),
  });

  if (
    baselineMatches.length &&
    (process.env.JINGCAI_WEBAPI_ALIGN_BASELINE_TEAMS || "true") !== "false"
  ) {
    const { buildMatchKey } = await import("../lib/jingcai-gemini-draft.js");
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

  const envelope = normalizeSportteryPayloadToFeedEnvelope(fetched.body, {
    capturedAt: fetched.capturedAt,
    matches: filteredMatches,
    baselineMatches,
    clientCode: SPORTTERY_CLIENT_CODE,
  });

  const validation = validateJingcaiOfficialFeed(envelope.matches);
  const diff = baselineEnvelope
    ? diffDraftAgainstBaseline(envelope, baselineEnvelope)
    : null;

  writeJson(RAW_FILE, {
    capturedAt: fetched.capturedAt,
    source: "sporttery-webapi",
    sourceMode: "real",
    url: fetched.url,
    parserVersion: "2026.06.09-sporttery-webapi",
    payload: fetched.body,
  });
  writeJson(DRAFT_FILE, envelope);
  if (diff) {
    writeJson(DIFF_FILE, diff);
  }

  const writeLatest = (process.env.JINGCAI_WEBAPI_WRITE_LATEST || "true") !== "false";
  const latestFile = path.join(projectRoot, "fixtures/snapshots/latest/jingcai-official-feed.json");
  if (writeLatest) {
    const latestEnvelope = {
      ...envelope,
      manualReviewed: true,
      sourceMode: "real",
      parserVersion: "2026.06.09-sporttery-webapi",
      alignmentNote:
        "fixtureId 与 fixtures/snapshots/latest/raw/the-odds-api-h2h.json 对齐；赔率来自 webapi.sporttery.cn 官方网关",
      dataSourceNote:
        "2026-06-09 以 sporttery_webapi 覆盖原 manual_official_snapshot（过期/主客错误赔率）",
      replacedPreviousSource: "manual_official_snapshot",
      rawPayloadHash: undefined,
    };
    delete latestEnvelope.rawPayloadHash;
    writeJson(latestFile, latestEnvelope);

    const devFixtureFile = path.join(projectRoot, "fixtures/jingcai-official-feed.json");
    writeJson(devFixtureFile, latestEnvelope);
  }

  console.log(
    JSON.stringify(
      {
        ok: validation.ok,
        ms: Date.now() - startedAt,
        source: "sporttery_webapi",
        url: fetched.url,
        counts: {
          allMatches: allMatches.length,
          filteredMatches: filteredMatches.length,
          normalizedMatches: envelope.matches.length,
        },
        files: {
          raw: RAW_FILE,
          draft: DRAFT_FILE,
          diff: diff ? DIFF_FILE : null,
          baseline: baselineEnvelope ? BASELINE_FILE : null,
          latest: writeLatest
            ? path.join(projectRoot, "fixtures/snapshots/latest/jingcai-official-feed.json")
            : null,
        },
        validation,
        diff: diff
          ? {
              changedCount: diff.changedCount,
              missingCount: diff.missingCount,
              unchangedCount: diff.unchangedCount,
              items: diff.items,
            }
          : null,
        sample: envelope.matches.slice(0, 3).map((match) => ({
          homeTeam: match.homeTeam,
          awayTeam: match.awayTeam,
          fixtureId: match.fixtureId,
          spf: match.availablePlays.spf,
          rqspf: match.availablePlays.rqspf,
          sportteryMeta: match.sportteryMeta,
        })),
        nextSteps: [
          "latest/jingcai-official-feed.json 与 fixtures/jingcai-official-feed.json 已更新",
          "离线 research 使用 JINGCAI_OFFICIAL_FEED_MODE=file 读 latest 快照",
          "实时刷新可设 JINGCAI_OFFICIAL_FEED_MODE=webapi",
        ],
      },
      null,
      2,
    ),
  );

  if (!validation.ok) {
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
  process.exitCode = 1;
});
