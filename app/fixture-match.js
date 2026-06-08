import { enrichUnifiedMatchStage } from "../lib/match-stage-label.js";
import { toDisplayTeamName } from "../lib/team-names.js";

const ENGLISH_ALIASES = {
  "korea republic": "South Korea",
  "republic of korea": "South Korea",
  "bosnia-herzegovina": "Bosnia & Herzegovina",
  "bosnia and herzegovina": "Bosnia & Herzegovina",
  "cote d'ivoire": "Côte d'Ivoire",
  "turkiye": "Turkey",
  "usa": "United States",
};

function normalizeToken(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function canonicalTeam(name) {
  const trimmed = String(name || "").trim();
  if (!trimmed) {
    return "";
  }
  const alias = ENGLISH_ALIASES[normalizeToken(trimmed)];
  return alias || trimmed;
}

function buildFixtureLabel(home, away) {
  return `${canonicalTeam(home)} vs ${canonicalTeam(away)}`;
}

export function buildFixtureKeys(home, away) {
  const canonicalHome = canonicalTeam(home);
  const canonicalAway = canonicalTeam(away);
  const keys = new Set([
    `${home} vs ${away}`,
    `${canonicalHome} vs ${canonicalAway}`,
    `${toDisplayTeamName(canonicalHome)} vs ${toDisplayTeamName(canonicalAway)}`,
    `${home} vs ${away}`.toLowerCase(),
    `${canonicalHome} vs ${canonicalAway}`.toLowerCase(),
  ]);
  return [...keys];
}

export function parseFixtureLabel(fixture) {
  const parts = String(fixture || "").split(/\s+vs\s+/i);
  if (parts.length !== 2) {
    return null;
  }
  return {
    home: parts[0].trim(),
    away: parts[1].trim(),
  };
}

export function buildPredictionLookup(predictions) {
  const map = new Map();
  for (const item of predictions) {
    const parsed = parseFixtureLabel(item.fixture);
    if (parsed) {
      for (const key of buildFixtureKeys(parsed.home, parsed.away)) {
        map.set(key, item);
      }
    }
    map.set(item.fixture, item);
    map.set(item.fixture.toLowerCase(), item);
  }
  return map;
}

export function buildNormalizedLookup(normalizedMatches) {
  const map = new Map();
  for (const item of normalizedMatches || []) {
    const parsed = parseFixtureLabel(item.fixture);
    if (parsed) {
      for (const key of buildFixtureKeys(parsed.home, parsed.away)) {
        map.set(key, item);
      }
    }
    map.set(item.fixture, item);
    map.set(String(item.fixtureId), item);
  }
  return map;
}

export function findPredictionForMatch(match, predictionLookup) {
  for (const key of buildFixtureKeys(match.home, match.away)) {
    const hit = predictionLookup.get(key);
    if (hit) {
      return hit;
    }
  }
  return null;
}

export function findNormalizedForMatch(match, normalizedLookup) {
  for (const key of buildFixtureKeys(match.home, match.away)) {
    const hit = normalizedLookup.get(key);
    if (hit) {
      return hit;
    }
  }
  return null;
}

export function buildUnifiedMatches(liveMatches, predictions) {
  const predictionLookup = buildPredictionLookup(predictions);
  const unified = [];
  const matchedPredictionIds = new Set();

  for (const match of liveMatches) {
    const prediction = findPredictionForMatch(match, predictionLookup);
    if (prediction?.id != null) {
      matchedPredictionIds.add(prediction.id);
    }
    unified.push(
      enrichUnifiedMatchStage({
        kind: "live",
        id: match.id,
        externalMatchId: match.externalMatchId ?? match.id,
        stageCode: match.stageCode ?? null,
        groupCode: match.groupCode ?? null,
        groupLetter: match.groupLetter ?? null,
        matchday: match.matchday ?? null,
        home: match.home,
        away: match.away,
        kickoff: match.kickoff,
        stage: match.stage,
        status: match.status,
        venue: match.venue,
        note: match.note,
        homeScore: match.homeScore,
        awayScore: match.awayScore,
        fixture: buildFixtureLabel(match.home, match.away),
        prediction,
      }),
    );
  }

  for (const prediction of predictions) {
    if (matchedPredictionIds.has(prediction.id)) {
      continue;
    }
    const parsed = parseFixtureLabel(prediction.fixture);
    unified.push(
      enrichUnifiedMatchStage({
        kind: "prediction-only",
        id: prediction.id,
        home: parsed?.home || prediction.fixture,
        away: parsed?.away || "",
        kickoff: prediction.kickoff,
        stage: prediction.stage || "预测盘面",
        status: "待开赛",
        venue: "",
        note: "仅预测数据，尚未与实时赛程对齐",
        homeScore: "-",
        awayScore: "-",
        fixture: prediction.fixture,
        prediction,
      }),
    );
  }

  return unified.sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff));
}
