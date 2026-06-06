import { toDisplayTeamName } from "../lib/team-names.js";

const ENGLISH_ALIASES = {
  "korea republic": "South Korea",
  "republic of korea": "South Korea",
  "bosnia-herzegovina": "Bosnia & Herzegovina",
  "bosnia and herzegovina": "Bosnia & Herzegovina",
  "cote d'ivoire": "Côte d'Ivoire",
  turkiye: "Turkey",
  usa: "United States",
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
