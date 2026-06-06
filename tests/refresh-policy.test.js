import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  REFRESH_TIERS,
  PROVIDER_CACHE_TTL_MS,
  formatRefreshPolicySummary,
  isTierStale,
} from "../app/refresh-policy.js";

describe("refresh-policy", () => {
  it("aligns schedule tier with football-data cache TTL", () => {
    assert.equal(REFRESH_TIERS.schedule.intervalMs, PROVIDER_CACHE_TTL_MS.footballData);
  });

  it("keeps signals tier within polymarket cache window", () => {
    assert.ok(REFRESH_TIERS.signals.intervalMs <= PROVIDER_CACHE_TTL_MS.polymarket);
    assert.equal(REFRESH_TIERS.signals.intervalMs, 8 * 60 * 1000);
  });

  it("uses slowest interval for metadata tier", () => {
    assert.equal(REFRESH_TIERS.metadata.intervalMs, PROVIDER_CACHE_TTL_MS.odds);
    assert.ok(REFRESH_TIERS.metadata.intervalMs >= REFRESH_TIERS.signals.intervalMs);
  });

  it("detects stale tiers", () => {
    const now = Date.now();
    assert.equal(isTierStale(now - REFRESH_TIERS.schedule.intervalMs - 1, "schedule"), true);
    assert.equal(isTierStale(now, "schedule"), false);
  });

  it("formats policy summary for UI", () => {
    assert.match(formatRefreshPolicySummary(), /赛程 5 分钟/);
    assert.match(formatRefreshPolicySummary(), /信号 8 分钟/);
    assert.match(formatRefreshPolicySummary(), /质量 30 分钟/);
  });
});
