/**
 * 高盛 / football-data / odds API / 竞彩 队名规范化与别名表。
 */
import { toDisplayTeamName } from "./team-names.js";

/** @type {Record<string, string>} alias -> canonical English */
export const CANONICAL_ENGLISH_ALIASES = {
  Algeria: "Algeria",
  Argentina: "Argentina",
  Australia: "Australia",
  Austria: "Austria",
  Belgium: "Belgium",
  Brazil: "Brazil",
  "Bosnia and H.": "Bosnia-Herzegovina",
  "Bosnia and Herz.": "Bosnia-Herzegovina",
  "Bosnia & Herzegovina": "Bosnia-Herzegovina",
  "Bosnia-Herzegovina": "Bosnia-Herzegovina",
  Canada: "Canada",
  "Cape Verde": "Cape Verde Islands",
  "Cape Verde Islands": "Cape Verde Islands",
  Colombia: "Colombia",
  Congo: "Congo DR",
  "Congo DR": "Congo DR",
  "DR Congo": "Congo DR",
  Croatia: "Croatia",
  Curacao: "Curaçao",
  Curaçao: "Curaçao",
  Czechia: "Czechia",
  "Czech Republic": "Czechia",
  Ecuador: "Ecuador",
  Egypt: "Egypt",
  England: "England",
  France: "France",
  Germany: "Germany",
  Ghana: "Ghana",
  Haiti: "Haiti",
  Iran: "Iran",
  Iraq: "Iraq",
  "Ivory Coast": "Ivory Coast",
  "Côte d'Ivoire": "Ivory Coast",
  Japan: "Japan",
  Jordan: "Jordan",
  Mexico: "Mexico",
  Morocco: "Morocco",
  Netherlands: "Netherlands",
  "New Zealand": "New Zealand",
  Norway: "Norway",
  Panama: "Panama",
  Paraguay: "Paraguay",
  Portugal: "Portugal",
  Qatar: "Qatar",
  "Saudi Arabia": "Saudi Arabia",
  Scotland: "Scotland",
  Senegal: "Senegal",
  "South Africa": "South Africa",
  "South Korea": "South Korea",
  "Korea Republic": "South Korea",
  Spain: "Spain",
  Sweden: "Sweden",
  Switzerland: "Switzerland",
  Tunisia: "Tunisia",
  Turkey: "Turkiye",
  Türkiye: "Turkiye",
  Turkiye: "Turkiye",
  Uruguay: "Uruguay",
  USA: "United States",
  "United States": "United States",
  Uzbekistan: "Uzbekistan",
};

export function normalizeCanonicalEnglishTeamName(name) {
  const trimmed = String(name || "").trim();
  if (!trimmed) {
    return "";
  }
  return CANONICAL_ENGLISH_ALIASES[trimmed] || trimmed;
}

export function buildMatchPairKey(homeTeam, awayTeam) {
  const home = normalizeCanonicalEnglishTeamName(homeTeam);
  const away = normalizeCanonicalEnglishTeamName(awayTeam);
  return `${home}__${away}`;
}

export function buildTeamAliasManifest() {
  const canonicalToAliases = new Map();

  for (const [alias, canonical] of Object.entries(CANONICAL_ENGLISH_ALIASES)) {
    if (!canonicalToAliases.has(canonical)) {
      canonicalToAliases.set(canonical, new Set());
    }
    canonicalToAliases.get(canonical).add(alias);
  }

  const teams = Array.from(canonicalToAliases.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([canonicalEnglish, aliases]) => ({
      canonicalEnglish,
      displayZh: toDisplayTeamName(canonicalEnglish),
      aliases: Array.from(aliases).sort(),
    }));

  return {
    version: "2026.06.09-goldman-fixture-join",
    description:
      "Canonical English team names for joining Goldman Sachs priors with football-data, odds API, and 竞彩 feeds.",
    teams,
  };
}
