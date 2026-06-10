/**
 * 生成 team-alias.json，并将高盛小组赛场次 join 到 pipeline fixtureId。
 *
 * npm run join:goldman-sachs-fixtures
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { buildGoldmanFixtureJoinEnvelope } from "../lib/goldman-sachs-fixture-join.js";
import { buildTeamAliasManifest } from "../lib/goldman-sachs-team-aliases.js";
import { projectRoot } from "../lib/paths.js";

const DEFAULT_PATHS = {
  gsGroupStage: "fixtures/fundamental-priors/goldman_sachs_worldcup2026_group_stage.json",
  footballData: "fixtures/snapshots/latest/raw/football-data-matches.json",
  oddsApi: "fixtures/snapshots/latest/raw/the-odds-api-h2h.json",
  jingcaiFeed: "fixtures/snapshots/latest/jingcai-official-feed.json",
  teamAliasOut: "fixtures/fundamental-priors/team-alias.json",
  joinedOut: "fixtures/fundamental-priors/goldman_sachs_worldcup2026_group_stage_joined.json",
};

function resolvePath(relativePath) {
  return path.isAbsolute(relativePath)
    ? relativePath
    : path.join(projectRoot, relativePath);
}

function readJson(relativePath) {
  const absolutePath = resolvePath(relativePath);
  if (!existsSync(absolutePath)) {
    throw new Error(`文件不存在: ${absolutePath}`);
  }
  return JSON.parse(readFileSync(absolutePath, "utf-8"));
}

function unwrapPayload(doc) {
  if (Array.isArray(doc)) {
    return doc;
  }
  if (Array.isArray(doc?.payload)) {
    return doc.payload;
  }
  if (Array.isArray(doc?.payload?.matches)) {
    return doc.payload.matches;
  }
  if (Array.isArray(doc?.matches)) {
    return doc.matches;
  }
  return [];
}

function main() {
  const paths = {
    gsGroupStage: process.env.GS_GROUP_STAGE_JSON || DEFAULT_PATHS.gsGroupStage,
    footballData: process.env.FOOTBALL_DATA_JSON || DEFAULT_PATHS.footballData,
    oddsApi: process.env.ODDS_API_JSON || DEFAULT_PATHS.oddsApi,
    jingcaiFeed: process.env.JINGCAI_FEED_JSON || DEFAULT_PATHS.jingcaiFeed,
    teamAliasOut: process.env.TEAM_ALIAS_JSON || DEFAULT_PATHS.teamAliasOut,
    joinedOut: process.env.GS_JOINED_JSON || DEFAULT_PATHS.joinedOut,
  };

  const gsGroupStage = readJson(paths.gsGroupStage);
  const footballDataDoc = readJson(paths.footballData);
  const oddsDoc = readJson(paths.oddsApi);
  const jingcaiDoc = readJson(paths.jingcaiFeed);

  const footballDataMatches = unwrapPayload(footballDataDoc);
  const oddsEvents = unwrapPayload(oddsDoc);
  const jingcaiMatches = unwrapPayload(jingcaiDoc);

  const teamAliasManifest = buildTeamAliasManifest();
  writeFileSync(
    resolvePath(paths.teamAliasOut),
    `${JSON.stringify(teamAliasManifest, null, 2)}\n`,
    "utf-8",
  );

  const envelope = buildGoldmanFixtureJoinEnvelope({
    gsGroupStage,
    footballDataMatches,
    oddsEvents,
    jingcaiMatches,
    options: {
      sourceFiles: paths,
    },
  });

  writeFileSync(resolvePath(paths.joinedOut), `${JSON.stringify(envelope, null, 2)}\n`, "utf-8");

  const pipelineOverlap = envelope.joinedMatches.filter(
    (match) => match.pipelineCoverage.oddsApi || match.pipelineCoverage.jingcaiOfficialFeed,
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        teamAliasOut: resolvePath(paths.teamAliasOut),
        joinedOut: resolvePath(paths.joinedOut),
        summary: envelope.summary,
        pipelineOverlap: {
          count: pipelineOverlap.length,
          sample: pipelineOverlap.slice(0, 5).map((match) => ({
            pairKey: match.pairKey,
            fixtureId: match.fixtureId,
            scoreline: match.scoreline,
            gsOutcome: match.gsOutcome,
            marketLean: match.marketLean,
            directionalAlignment: match.directionalAlignment,
          })),
        },
      },
      null,
      2,
    ),
  );
}

main();
