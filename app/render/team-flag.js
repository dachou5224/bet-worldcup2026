import { escapeHtml } from "../format.js";
import { getTeamFlagUrl } from "../../lib/team-flags.js";

function flagDisplaySize(width) {
  if (width >= 48) {
    return { width: 26, height: 20 };
  }
  if (width >= 40) {
    return { width: 22, height: 16 };
  }
  return { width: 18, height: 14 };
}

function renderFlagImg(teamName, { width = 40, className = "team-flag" } = {}) {
  const url = getTeamFlagUrl(teamName, { width });
  if (!url) {
    return "";
  }
  const size = flagDisplaySize(width);
  return `<img class="${className}" src="${url}" alt="" width="${size.width}" height="${size.height}" loading="lazy" decoding="async" />`;
}

export function renderTeamWithFlag(teamName, { width = 40, className = "team-flag" } = {}) {
  const flag = renderFlagImg(teamName, { width, className });
  if (!flag) {
    return `<span class="team-with-flag">${escapeHtml(teamName)}</span>`;
  }
  return `<span class="team-with-flag">${flag}<span>${escapeHtml(teamName)}</span></span>`;
}

export function renderFixtureWithFlags(home, away, { width = 40, vsLabel = "vs" } = {}) {
  return `<span class="fixture-teams-with-flags">${renderTeamWithFlag(home, { width })}<span class="fixture-vs">${escapeHtml(vsLabel)}</span>${renderTeamWithFlag(away, { width })}</span>`;
}

export function renderFixtureLabelWithFlags(fixtureLabel, options = {}) {
  const text = String(fixtureLabel || "").trim();
  const parts = text.split(/\s+vs\s+/i);
  if (parts.length >= 2) {
    return renderFixtureWithFlags(parts[0].trim(), parts.slice(1).join(" vs ").trim(), options);
  }
  return escapeHtml(text);
}
