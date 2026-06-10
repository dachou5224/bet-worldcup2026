import { normalizeCanonicalEnglishTeamName } from "./goldman-sachs-team-aliases.js";
import { toDisplayTeamName } from "./team-names.js";

function normalizeFixtureTeamName(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return "";
  }

  return toDisplayTeamName(normalizeCanonicalEnglishTeamName(trimmed));
}

export function buildFixtureKey(home, away) {
  return `${normalizeFixtureTeamName(home)}__${normalizeFixtureTeamName(away)}`;
}

export function buildFixtureLabel(home, away) {
  return `${home} vs ${away}`;
}
