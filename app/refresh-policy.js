/**
 * 前端自动刷新策略（与 provider-config 默认 TTL、QUANT_STRATEGY_SPEC 对齐）
 *
 * 后台 provider 缓存参考（秒 → 本文件 intervalMs）：
 * - ODDS_CACHE_TTL_SECONDS=1800        → 信号层 ≤ 15min
 * - POLYMARKET_CACHE_TTL_SECONDS=900   → 信号层 ~8min（约 TTL/2，捕捉 Dispersion）
 * - FOOTBALL_DATA_CACHE_TTL_SECONDS=300 → 赛程层 5min
 * - BZZOIRO_CACHE_TTL_SECONDS=1800     → 归入 metadata 30min
 *
 * 规格依据摘要：
 * - §2.2 盘口快照：closing > pre-match 1h > 24h > opening，无需秒级轮询
 * - §2.3 预测市场：流动性/价格变化中等频率
 * - §2.1 赛程/赛果：赛前低频；赛中状态由 live provider 缓存约束
 * - §5.4 / §6.5 复盘与体彩 officialEV：赛后与临停售前刷新，日常低频
 */

const MINUTE = 60 * 1000;

/** 与 provider-config.js 默认 TTL 一致，供文档与测试对照 */
export const PROVIDER_CACHE_TTL_MS = {
  odds: 30 * MINUTE,
  polymarket: 15 * MINUTE,
  footballData: 5 * MINUTE,
  bzzoiro: 30 * MINUTE,
};

/**
 * @typedef {{ key: string, intervalMs: number, label: string, endpoints: string[], rationale: string }} RefreshTier
 */

/** @type {Record<'schedule' | 'signals' | 'metadata', RefreshTier>} */
export const REFRESH_TIERS = {
  schedule: {
    key: "schedule",
    intervalMs: PROVIDER_CACHE_TTL_MS.footballData,
    label: "赛程与赛况",
    endpoints: ["/api/live-matches"],
    rationale: "赛程、开球时间、比分状态；对齐 football-data 5 分钟缓存，赛前变化慢",
  },
  signals: {
    key: "signals",
    intervalMs: 8 * MINUTE,
    label: "价值信号与盘口",
    endpoints: ["/api/dashboard", "/api/data/normalized-matches"],
    rationale: "去水概率、EV 分歧、让分/大小球；对齐 Polymarket 15 分钟缓存的一半",
  },
  metadata: {
    key: "metadata",
    intervalMs: PROVIDER_CACHE_TTL_MS.odds,
    label: "数据质量与复盘",
    endpoints: [
      "/api/data/quality-report",
      "/api/data/provider-coverage",
      "/api/post-match-review",
    ],
    rationale: "质量告警、provider 覆盖、赛后复盘；对齐赔率/Bzzoiro 30 分钟缓存",
  },
};

/** @deprecated 使用 REFRESH_TIERS；保留以免旧引用报错 */
export const AUTO_REFRESH_MS = REFRESH_TIERS.signals.intervalMs;

export function getRefreshTier(tierKey) {
  return REFRESH_TIERS[tierKey];
}

export function formatRefreshPolicySummary() {
  const minutes = (ms) => Math.round(ms / MINUTE);
  return [
    `赛程 ${minutes(REFRESH_TIERS.schedule.intervalMs)} 分钟`,
    `信号 ${minutes(REFRESH_TIERS.signals.intervalMs)} 分钟`,
    `质量 ${minutes(REFRESH_TIERS.metadata.intervalMs)} 分钟`,
  ].join(" · ");
}

export function isTierStale(lastRefreshedAt, tierKey) {
  const tier = REFRESH_TIERS[tierKey];
  if (!tier || !lastRefreshedAt) {
    return true;
  }
  return Date.now() - lastRefreshedAt >= tier.intervalMs;
}
