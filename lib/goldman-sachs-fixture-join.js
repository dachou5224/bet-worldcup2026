import { proportionalDevig } from "../quant/odds/devig.js";
import {
  buildMatchPairKey,
  normalizeCanonicalEnglishTeamName,
} from "./goldman-sachs-team-aliases.js";
import { toDisplayTeamName } from "./team-names.js";

function round(value, digits = 4) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function parseGroupLetter(group) {
  return String(group || "")
    .replace(/^GROUP_/i, "")
    .toUpperCase();
}

export function gsResultTypeToOutcome(resultType) {
  if (resultType === "home_win") {
    return "home";
  }
  if (resultType === "away_win") {
    return "away";
  }
  if (resultType === "draw") {
    return "draw";
  }
  return null;
}

export function inferMarketLean(probabilities = {}) {
  const home = probabilities.home ?? 0;
  const draw = probabilities.draw ?? 0;
  const away = probabilities.away ?? 0;
  const max = Math.max(home, draw, away);
  if (max <= 0) {
    return null;
  }
  if (home === max) {
    return "home";
  }
  if (draw === max) {
    return "draw";
  }
  return "away";
}

export function compareDirectionalAlignment(gsResultType, marketLean) {
  const gsOutcome = gsResultTypeToOutcome(gsResultType);
  if (!gsOutcome || !marketLean) {
    return "unknown";
  }
  return gsOutcome === marketLean ? "aligned" : "divergent";
}

function averageBookmakerH2h(event) {
  const homeTeam = event.home_team;
  const awayTeam = event.away_team;
  const perBookmaker = [];

  for (const bookmaker of event.bookmakers || []) {
    const market = (bookmaker.markets || []).find((entry) => entry.key === "h2h");
    if (!market) {
      continue;
    }

    const outcomes = (market.outcomes || [])
      .map((outcome) => {
        if (outcome.name === "Draw") {
          return { name: "draw", decimalOdds: outcome.price };
        }
        if (outcome.name === homeTeam) {
          return { name: "home", decimalOdds: outcome.price };
        }
        if (outcome.name === awayTeam) {
          return { name: "away", decimalOdds: outcome.price };
        }
        return null;
      })
      .filter(Boolean);

    if (outcomes.length !== 3) {
      continue;
    }

    const fair = proportionalDevig(outcomes);
    perBookmaker.push(
      fair.reduce(
        (acc, outcome) => {
          acc[outcome.name] = outcome.fairProbability;
          return acc;
        },
        { home: 0, draw: 0, away: 0 },
      ),
    );
  }

  if (!perBookmaker.length) {
    return null;
  }

  const sums = { home: 0, draw: 0, away: 0 };
  for (const probs of perBookmaker) {
    sums.home += probs.home;
    sums.draw += probs.draw;
    sums.away += probs.away;
  }

  return {
    home: round(sums.home / perBookmaker.length),
    draw: round(sums.draw / perBookmaker.length),
    away: round(sums.away / perBookmaker.length),
    bookmakerCount: perBookmaker.length,
  };
}

export function buildFootballDataIndex(matches = []) {
  const byPair = new Map();
  const byGroupDayPair = new Map();

  for (const match of matches) {
    if (match.stage !== "GROUP_STAGE") {
      continue;
    }

    const homeTeam = normalizeCanonicalEnglishTeamName(match.homeTeam?.name);
    const awayTeam = normalizeCanonicalEnglishTeamName(match.awayTeam?.name);
    const pairKey = buildMatchPairKey(homeTeam, awayTeam);
    const group = parseGroupLetter(match.group);
    const matchDay = match.matchday;

    const record = {
      footballDataMatchId: match.id,
      group,
      matchDay,
      homeTeam,
      awayTeam,
      utcDate: match.utcDate,
      pairKey,
    };

    byPair.set(pairKey, record);
    byGroupDayPair.set(`${group}:${matchDay}:${pairKey}`, record);
  }

  return { byPair, byGroupDayPair };
}

export function buildOddsApiIndex(events = []) {
  const byPair = new Map();
  const byFixtureId = new Map();

  for (const event of events) {
    const homeTeam = normalizeCanonicalEnglishTeamName(event.home_team);
    const awayTeam = normalizeCanonicalEnglishTeamName(event.away_team);
    const pairKey = buildMatchPairKey(homeTeam, awayTeam);
    const fixtureId = Number(event.id);
    const marketH2h = averageBookmakerH2h(event);

    const record = {
      fixtureId,
      pairKey,
      homeTeam,
      awayTeam,
      commenceTime: event.commence_time,
      marketH2h,
      marketLean: marketH2h ? inferMarketLean(marketH2h) : null,
    };

    byPair.set(pairKey, record);
    byFixtureId.set(fixtureId, record);
  }

  return { byPair, byFixtureId };
}

export function buildJingcaiIndex(matches = []) {
  const byFixtureId = new Map();
  const byPairZh = new Map();

  for (const match of matches) {
    const fixtureId = Number(match.fixtureId);
    const homeZh = match.homeTeam;
    const awayZh = match.awayTeam;
    const record = {
      fixtureId,
      jingcaiMatchId: match.jingcaiMatchId,
      homeTeamZh: homeZh,
      awayTeamZh: awayZh,
      kickoffLocal: match.kickoffLocal,
      saleStatus: match.saleStatus,
    };

    byFixtureId.set(fixtureId, record);
    byPairZh.set(`${homeZh}__${awayZh}`, record);
  }

  return { byFixtureId, byPairZh };
}

export function joinGoldmanGroupStageMatch(gsMatch, indexes = {}) {
  const homeTeamGs = gsMatch.homeTeam;
  const awayTeamGs = gsMatch.awayTeam;
  const homeTeam = normalizeCanonicalEnglishTeamName(homeTeamGs);
  const awayTeam = normalizeCanonicalEnglishTeamName(awayTeamGs);
  const pairKey = buildMatchPairKey(homeTeam, awayTeam);
  const group = parseGroupLetter(gsMatch.group);

  const footballData =
    indexes.footballData?.byGroupDayPair.get(`${group}:${gsMatch.matchDay}:${pairKey}`) ||
    indexes.footballData?.byPair.get(pairKey) ||
    null;
  const oddsApi = indexes.oddsApi?.byPair.get(pairKey) || null;
  const jingcai =
    (oddsApi ? indexes.jingcai?.byFixtureId.get(oddsApi.fixtureId) : null) || null;

  const marketH2h = oddsApi?.marketH2h || null;
  const marketLean = oddsApi?.marketLean || null;
  const directionalAlignment = compareDirectionalAlignment(gsMatch.resultType, marketLean);

  const joinStatus = footballData ? "matched" : "football_data_missing";

  return {
    group,
    matchDay: gsMatch.matchDay,
    date: gsMatch.date,
    homeTeamGs,
    awayTeamGs,
    homeTeamCanonical: homeTeam,
    awayTeamCanonical: awayTeam,
    homeTeamZh: toDisplayTeamName(homeTeam),
    awayTeamZh: toDisplayTeamName(awayTeam),
    pairKey,
    scoreline: gsMatch.scoreline,
    gsResultType: gsMatch.resultType,
    gsOutcome: gsResultTypeToOutcome(gsMatch.resultType),
    joinStatus,
    footballDataMatchId: footballData?.footballDataMatchId ?? null,
    fixtureId: oddsApi?.fixtureId ?? null,
    jingcaiMatchId: jingcai?.jingcaiMatchId ?? null,
    pipelineCoverage: {
      footballData: Boolean(footballData),
      oddsApi: Boolean(oddsApi),
      jingcaiOfficialFeed: Boolean(jingcai),
    },
    marketH2h,
    marketLean,
    directionalAlignment,
    commenceTime: oddsApi?.commenceTime ?? footballData?.utcDate ?? null,
    kickoffLocal: jingcai?.kickoffLocal ?? null,
  };
}

export function buildGoldmanFixtureJoinEnvelope({
  gsGroupStage,
  footballDataMatches = [],
  oddsEvents = [],
  jingcaiMatches = [],
  options = {},
}) {
  const indexes = {
    footballData: buildFootballDataIndex(footballDataMatches),
    oddsApi: buildOddsApiIndex(oddsEvents),
    jingcai: buildJingcaiIndex(jingcaiMatches),
  };

  const joinedMatches = (gsGroupStage.matches || []).map((match) =>
    joinGoldmanGroupStageMatch(match, indexes),
  );

  const summary = {
    totalGsMatches: joinedMatches.length,
    footballDataMatched: joinedMatches.filter((m) => m.pipelineCoverage.footballData).length,
    oddsApiMatched: joinedMatches.filter((m) => m.pipelineCoverage.oddsApi).length,
    jingcaiMatched: joinedMatches.filter((m) => m.pipelineCoverage.jingcaiOfficialFeed).length,
    directionalAligned: joinedMatches.filter((m) => m.directionalAlignment === "aligned").length,
    directionalDivergent: joinedMatches.filter((m) => m.directionalAlignment === "divergent")
      .length,
    directionalUnknown: joinedMatches.filter((m) => m.directionalAlignment === "unknown").length,
  };

  return {
    generatedAt: options.generatedAt || new Date().toISOString(),
    sourceFiles: options.sourceFiles || {},
    summary,
    indexes: {
      footballDataGroupMatches: footballDataMatches.filter((m) => m.stage === "GROUP_STAGE").length,
      oddsApiEvents: oddsEvents.length,
      jingcaiMatches: jingcaiMatches.length,
    },
    joinedMatches,
  };
}
