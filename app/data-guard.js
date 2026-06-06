import { buildFixtureKeys, parseFixtureLabel } from "./fixture-match.js";

export const TEMPORARY_MARKET_MODES = new Set([
  "mock",
  "file",
  "real_fallback_mock",
  "real_unconfigured_fallback_mock",
]);

export const TEMPORARY_LIVE_MODES = new Set([
  "mock",
  "real_fallback_mock",
  "real_unconfigured_fallback_mock",
]);

export function isTemporaryMarketMode(mode) {
  return TEMPORARY_MARKET_MODES.has(mode);
}

export function isTemporaryLiveMode(mode) {
  return TEMPORARY_LIVE_MODES.has(mode);
}

export function hasTrustedLiveFeed(dashboard) {
  return dashboard.liveDataMode === "real" && (dashboard.liveMatches?.length || 0) > 0;
}

export function hasTrustedMarketFeed(dashboard) {
  return dashboard.marketDataMode === "real";
}

function blockEntry(audit, type, id, reason, detail) {
  audit.blocked.push({ type, id, reason, detail });
}

function buildAllowedFixtureKeys(liveMatches) {
  const keys = new Set();
  for (const match of liveMatches || []) {
    for (const key of buildFixtureKeys(match.home, match.away)) {
      keys.add(key.toLowerCase());
    }
  }
  return keys;
}

function fixtureInAllowedSet(fixture, allowedFixtureKeys) {
  const parsed = parseFixtureLabel(fixture);
  if (!parsed) {
    return false;
  }

  for (const key of buildFixtureKeys(parsed.home, parsed.away)) {
    if (allowedFixtureKeys.has(key.toLowerCase())) {
      return true;
    }
  }

  return false;
}

function kickoffDayKey(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(parsed);
}

export function detectTeamDayConflicts(liveMatches, predictions) {
  const byTeamDay = new Map();
  const warnings = [];

  const register = (fixture, kickoff, source) => {
    const parsed = parseFixtureLabel(fixture);
    if (!parsed) {
      return;
    }

    const day = kickoffDayKey(kickoff);
    if (!day) {
      return;
    }

    for (const team of [parsed.home, parsed.away]) {
      const token = `${team.trim().toLowerCase()}@${day}`;
      const entries = byTeamDay.get(token) || [];
      entries.push({ fixture, source });
      byTeamDay.set(token, entries);
    }
  };

  for (const match of liveMatches || []) {
    register(`${match.home} vs ${match.away}`, match.kickoff, "live");
  }

  for (const prediction of predictions || []) {
    register(prediction.fixture, prediction.kickoff, "prediction");
  }

  for (const [token, entries] of byTeamDay.entries()) {
    const fixtures = [...new Set(entries.map((entry) => entry.fixture))];
    if (fixtures.length <= 1) {
      continue;
    }

    const [team, day] = token.split("@");
    warnings.push({
      code: "team_day_conflict",
      team,
      day,
      fixtures,
      message: `${team} 在 ${day} 出现 ${fixtures.length} 场不同对阵，可能存在未对齐的临时数据。`,
    });
  }

  return warnings;
}

export function sanitizeDashboardBundle(bundle) {
  const audit = {
    blocked: [],
    warnings: [],
    policy: "frontend_mock_intercept_v1",
  };

  const dashboard = {
    ...bundle.dashboard,
    liveMatches: [...(bundle.dashboard?.liveMatches || [])],
    tomorrowPredictions: [...(bundle.dashboard?.tomorrowPredictions || [])],
    completedComparisons: [...(bundle.dashboard?.completedComparisons || [])],
    expertOpinions: [...(bundle.dashboard?.expertOpinions || [])],
  };

  const trustedLive = hasTrustedLiveFeed(dashboard);
  const allowedFixtureKeys = trustedLive ? buildAllowedFixtureKeys(dashboard.liveMatches) : new Set();

  if (isTemporaryLiveMode(dashboard.liveDataMode)) {
    for (const match of dashboard.liveMatches) {
      blockEntry(audit, "liveMatch", match.id, "temporary_live_feed", `${match.home} vs ${match.away}`);
    }
    dashboard.liveMatches = [];
  }

  if (isTemporaryMarketMode(dashboard.marketDataMode)) {
    const keptPredictions = [];
    for (const prediction of dashboard.tomorrowPredictions) {
      if (trustedLive && fixtureInAllowedSet(prediction.fixture, allowedFixtureKeys)) {
        keptPredictions.push(prediction);
      } else {
        blockEntry(audit, "prediction", prediction.id, "temporary_market_fixture", prediction.fixture);
      }
    }
    dashboard.tomorrowPredictions = keptPredictions;

    for (const comparison of dashboard.completedComparisons) {
      blockEntry(audit, "completedComparison", comparison.fixture, "demo_review_data", comparison.fixture);
    }
    dashboard.completedComparisons = [];

    dashboard.expertOpinions = dashboard.expertOpinions.filter((entry) => {
      if (trustedLive && fixtureInAllowedSet(entry.fixture, allowedFixtureKeys)) {
        return true;
      }
      blockEntry(audit, "expertOpinion", entry.fixture, "temporary_market_fixture", entry.fixture);
      return false;
    });
  }

  let normalizedMatches = [...(bundle.normalizedMatches || [])];
  if (isTemporaryMarketMode(dashboard.marketDataMode)) {
    normalizedMatches = normalizedMatches.filter((item) => {
      if (trustedLive && fixtureInAllowedSet(item.fixture, allowedFixtureKeys)) {
        return true;
      }
      blockEntry(audit, "normalizedMatch", item.fixtureId, "temporary_market_fixture", item.fixture);
      return false;
    });
  }

  audit.warnings.push(...detectTeamDayConflicts(dashboard.liveMatches, dashboard.tomorrowPredictions));

  audit.stats = {
    blockedCount: audit.blocked.length,
    predictionsKept: dashboard.tomorrowPredictions.length,
    liveKept: dashboard.liveMatches.length,
    normalizedKept: normalizedMatches.length,
  };

  return {
    ...bundle,
    dashboard,
    normalizedMatches,
    dataAudit: audit,
  };
}
