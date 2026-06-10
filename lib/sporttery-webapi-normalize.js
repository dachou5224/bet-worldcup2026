import { buildMatchKey } from "./jingcai-gemini-draft.js";
import { findOddsPool, findPoolStatus } from "./sporttery-webapi.js";

const OFF_PLAY = { onSale: false, odds: {} };

function parseDecimalOdds(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseGoalLine(value) {
  if (value == null || value === "") {
    return null;
  }

  const parsed = Number(String(value).replace(/\+/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function toOdds310FromHad(had) {
  if (!had) {
    return {};
  }

  const odds = {};
  const win = parseDecimalOdds(had.h);
  const draw = parseDecimalOdds(had.d);
  const lose = parseDecimalOdds(had.a);
  if (win != null) odds["3"] = win;
  if (draw != null) odds["1"] = draw;
  if (lose != null) odds["0"] = lose;
  return odds;
}

function buildKickoffLocal(matchDate, matchTime) {
  if (!matchDate || !matchTime) {
    return null;
  }

  const segments = String(matchTime).trim().split(":");
  const hours = segments[0]?.padStart(2, "0") || "00";
  const minutes = segments[1]?.padStart(2, "0") || "00";
  const seconds = segments[2]?.padStart(2, "0") || "00";
  return `${matchDate}T${hours}:${minutes}:${seconds}+08:00`;
}

function resolveSaleStatus(match, poolCode) {
  if (match.matchStatus !== "Selling" && match.sellStatus !== "1") {
    return "not_on_sale";
  }

  const pool = findPoolStatus(match, poolCode);
  if (pool?.poolStatus && pool.poolStatus !== "Selling") {
    return "not_on_sale";
  }

  return "on_sale";
}

export function normalizeSportteryMatchToJingcaiRecord(match, options = {}) {
  const capturedAt = options.capturedAt || new Date().toISOString();
  const baseline = options.baselineByKey?.get(
    buildMatchKey(match.homeTeamAllName, match.awayTeamAllName),
  );

  const had = findOddsPool(match, "HAD");
  const hhad = findOddsPool(match, "HHAD");
  const spfOdds = toOdds310FromHad(had);
  const rqspfOdds = toOdds310FromHad(hhad);
  const spfOnSale = resolveSaleStatus(match, "HAD") === "on_sale" && Object.keys(spfOdds).length === 3;
  const rqspfOnSale =
    resolveSaleStatus(match, "HHAD") === "on_sale" && Object.keys(rqspfOdds).length === 3;

  return {
    jingcaiMatchId: baseline?.jingcaiMatchId || `JC-${match.matchId}`,
    fixtureId: baseline?.fixtureId ?? options.fixtureId ?? null,
    competition: match.leagueAllName || baseline?.competition || "2026 FIFA World Cup",
    stage: baseline?.stage || options.stage || "小组赛",
    homeTeam: match.homeTeamAllName,
    awayTeam: match.awayTeamAllName,
    kickoffLocal:
      buildKickoffLocal(match.matchDate, match.matchTime) || baseline?.kickoffLocal || null,
    saleStatus: spfOnSale || rqspfOnSale ? "on_sale" : "not_on_sale",
    stopSaleTime: baseline?.stopSaleTime || null,
    availablePlays: {
      spf: {
        onSale: spfOnSale,
        odds: spfOnSale ? spfOdds : {},
      },
      rqspf: {
        onSale: rqspfOnSale,
        handicap: parseGoalLine(hhad?.goalLine) ?? baseline?.availablePlays?.rqspf?.handicap ?? null,
        odds: rqspfOnSale ? rqspfOdds : {},
      },
      zjq: { ...OFF_PLAY },
      bf: { ...OFF_PLAY },
      bqc: { ...OFF_PLAY },
    },
    ruleVersion: baseline?.ruleVersion || "2026-jczq-football",
    fetchedAt: capturedAt,
    sportteryMeta: {
      matchId: match.matchId,
      matchNumStr: match.matchNumStr,
      matchStatus: match.matchStatus,
      leagueId: match.leagueId,
      sourceUrl: "https://www.sporttery.cn/jc/jsq/zqspf/",
    },
  };
}

export function normalizeSportteryPayloadToFeedEnvelope(payload, options = {}) {
  const capturedAt = options.capturedAt || new Date().toISOString();
  const matches = options.matches || [];
  const baselineMatches = options.baselineMatches || [];
  const baselineByKey = new Map(
    baselineMatches.map((match) => [buildMatchKey(match.homeTeam, match.awayTeam), match]),
  );

  const normalizedMatches = matches.map((match) =>
    normalizeSportteryMatchToJingcaiRecord(match, {
      capturedAt,
      baselineByKey,
      stage: options.stage,
    }),
  );

  return {
    capturedAt,
    source: "sporttery_webapi",
    sourceUrl: "https://www.sporttery.cn/jc/jsq/zqspf/",
    manualReviewed: false,
    directEVEligible: true,
    sourceMode: "real",
    parserVersion: "2026.06.09-sporttery-webapi",
    alignmentNote:
      options.alignmentNote ||
      "fixtureId/stopSaleTime 优先从 baseline 对齐；赔率来自 webapi.sporttery.cn 官方网关",
    sporttery: {
      lastUpdateTime: payload?.value?.lastUpdateTime || null,
      totalCount: payload?.value?.totalCount || normalizedMatches.length,
      clientCode: options.clientCode || "3001",
    },
    matches: normalizedMatches,
  };
}

export function filterSportteryMatches(matches, options = {}) {
  const leagueName = options.leagueName || process.env.JINGCAI_WEBAPI_LEAGUE_FILTER || "世界杯";
  const teamFilter = (options.teamNames || [])
    .map((name) => String(name).trim())
    .filter(Boolean);

  return matches.filter((match) => {
    const inLeague = leagueName
      ? (match.leagueAllName || "").includes(leagueName) ||
        (match.leagueAbbName || "").includes(leagueName)
      : true;

    if (!inLeague) {
      return false;
    }

    if (!teamFilter.length) {
      return true;
    }

    const label = `${match.homeTeamAllName || ""}${match.awayTeamAllName || ""}`;
    return teamFilter.some((team) => label.includes(team));
  });
}
