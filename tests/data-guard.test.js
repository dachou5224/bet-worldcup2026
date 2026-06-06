import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  sanitizeDashboardBundle,
  detectTeamDayConflicts,
  isTemporaryMarketMode,
} from "../app/data-guard.js";

describe("data-guard", () => {
  it("blocks mock predictions that do not align with trusted live fixtures", () => {
    const bundle = sanitizeDashboardBundle({
      dashboard: {
        marketDataMode: "real_fallback_mock",
        liveDataMode: "real",
        liveMatches: [{ id: 1, home: "墨西哥", away: "南非", kickoff: "2026-06-11T19:00:00Z" }],
        tomorrowPredictions: [
          { id: 1, fixture: "墨西哥 vs 日本", kickoff: "2026-06-11 20:00 CST" },
          { id: 2, fixture: "美国 vs 摩洛哥", kickoff: "2026-06-11 21:30 ET" },
        ],
        completedComparisons: [{ fixture: "阿根廷 vs 丹麦" }],
        expertOpinions: [{ fixture: "墨西哥 vs 日本", opinions: [] }],
      },
      normalizedMatches: [
        { fixtureId: 1, fixture: "墨西哥 vs 日本" },
        { fixtureId: 2, fixture: "美国 vs 摩洛哥" },
      ],
    });

    assert.equal(bundle.dashboard.liveMatches.length, 1);
    assert.equal(bundle.dashboard.tomorrowPredictions.length, 0);
    assert.equal(bundle.normalizedMatches.length, 0);
    assert.equal(bundle.dashboard.completedComparisons.length, 0);
    assert.ok(bundle.dataAudit.blocked.some((item) => item.detail === "墨西哥 vs 日本"));
    assert.ok(isTemporaryMarketMode("real_fallback_mock"));
  });

  it("keeps aligned predictions when market is fully real", () => {
    const bundle = sanitizeDashboardBundle({
      dashboard: {
        marketDataMode: "real",
        liveDataMode: "real",
        liveMatches: [{ id: 1, home: "墨西哥", away: "南非", kickoff: "2026-06-11T19:00:00Z" }],
        tomorrowPredictions: [{ id: 1, fixture: "墨西哥 vs 南非", kickoff: "2026-06-11T19:00:00Z" }],
        completedComparisons: [{ fixture: "阿根廷 vs 丹麦" }],
      },
      normalizedMatches: [{ fixtureId: 1, fixture: "墨西哥 vs 南非" }],
    });

    assert.equal(bundle.dashboard.tomorrowPredictions.length, 1);
    assert.equal(bundle.dashboard.completedComparisons.length, 1);
    assert.equal(bundle.dataAudit.blocked.length, 0);
  });

  it("blocks temporary live feeds entirely", () => {
    const bundle = sanitizeDashboardBundle({
      dashboard: {
        marketDataMode: "mock",
        liveDataMode: "mock",
        liveMatches: [{ id: 9, home: "墨西哥", away: "日本", kickoff: "2026-06-11T20:00:00Z" }],
        tomorrowPredictions: [{ id: 1, fixture: "墨西哥 vs 日本", kickoff: "2026-06-11T20:00:00Z" }],
      },
      normalizedMatches: [],
    });

    assert.equal(bundle.dashboard.liveMatches.length, 0);
    assert.equal(bundle.dashboard.tomorrowPredictions.length, 0);
    assert.ok(bundle.dataAudit.blocked.length >= 2);
  });

  it("detects same-team same-day conflicts", () => {
    const warnings = detectTeamDayConflicts(
      [{ home: "墨西哥", away: "南非", kickoff: "2026-06-11T19:00:00Z" }],
      [{ fixture: "墨西哥 vs 日本", kickoff: "2026-06-12T02:00:00.000Z" }],
    );

    assert.equal(warnings.length, 1);
    assert.equal(warnings[0].code, "team_day_conflict");
  });
});
