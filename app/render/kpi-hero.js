import { escapeHtml, formatMode, formatTimestamp, formatConfidence } from "../format.js";
import { computeDisagreement, computeConfidenceScore } from "../metrics.js";
import { filterPredictions } from "../filters.js";
import { isTemporaryLiveMode, isTemporaryMarketMode } from "../data-guard.js";
import { formatRefreshPolicySummary } from "../refresh-policy.js";

function summarizeBlocked(audit) {
  if (!audit?.blocked?.length) {
    return "";
  }

  const byType = audit.blocked.reduce((acc, item) => {
    acc[item.type] = (acc[item.type] || 0) + 1;
    return acc;
  }, {});

  return Object.entries(byType)
    .map(([type, count]) => `${type} ${count}`)
    .join(" · ");
}

export function renderKpiHero(data, bundle = {}) {
  const predictions = data.tomorrowPredictions || [];
  const strongCount = predictions.filter((item) => computeConfidenceScore(item) >= 75).length;
  const watchCount = predictions.filter((item) => item.confidence === "low").length;
  const normalizedCount = bundle.normalizedMatches?.length || 0;
  const scanned =
    normalizedCount || predictions.length + (data.liveMatches?.length || 0);

  document.querySelector("#kpi-scanned").textContent = scanned;
  document.querySelector("#kpi-recommended").textContent = predictions.length;
  document.querySelector("#kpi-strong").textContent = strongCount;
  document.querySelector("#kpi-watch").textContent = watchCount;
  document.querySelector("#tournament-status").textContent = escapeHtml(data.tournamentStatus);
}

export function renderFallbackBanner(data, audit = null) {
  const banner = document.querySelector("#fallback-banner");
  const temporaryMarket = isTemporaryMarketMode(data.marketDataMode);
  const temporaryLive = isTemporaryLiveMode(data.liveDataMode);
  const blockedCount = audit?.blocked?.length || 0;
  const warningCount = audit?.warnings?.length || 0;
  const shouldShow = temporaryMarket || temporaryLive || blockedCount > 0 || warningCount > 0;

  banner.classList.toggle("hidden", !shouldShow);
  if (!shouldShow) {
    return;
  }

  const lines = [];

  if (temporaryMarket || temporaryLive) {
    lines.push(
      `检测到临时/回退数据源（市场：${formatMode(data.marketDataMode)}，实时：${formatMode(data.liveDataMode)}）。前端已拦截未对齐的 mock 条目，仅展示与可信赛程一致的数据。`,
    );
  }

  if (blockedCount > 0) {
    lines.push(`已拦截 ${blockedCount} 条临时数据（${summarizeBlocked(audit)}）。`);
  }

  if (warningCount > 0) {
    lines.push(audit.warnings.map((item) => item.message).join(" "));
  }

  banner.innerHTML = `
    <strong>数据审核</strong>
    <span>${escapeHtml(lines.join(" "))}</span>
  `;
}

export function renderStatusBar(data, isError = false) {
  const providerHealth = data.providerHealth || {};
  const oddsStatus = providerHealth.oddsStatus || (providerHealth.source === "mock" ? "mock" : "unknown");
  const polymarketStatus = providerHealth.polymarketStatus || "skipped";

  document.querySelector("#last-updated").textContent = isError
    ? "API 加载失败，请确认本地服务已启动"
    : `刷新于 ${formatTimestamp(new Date(data.lastUpdated))}`;
  document.querySelector("#last-updated").classList.toggle("pill-error", isError);

  document.querySelector("#source-status-bar").innerHTML = `
    <span class="status-chip">市场：${escapeHtml(formatMode(data.marketDataMode || "mock"))}</span>
    <span class="status-chip">实时：${escapeHtml(formatMode(data.liveDataMode || "mock"))}</span>
    <span class="status-chip status-chip-${oddsStatus === "ok" ? "good" : "warn"}">赔率：${escapeHtml(oddsStatus)}</span>
    <span class="status-chip status-chip-${polymarketStatus === "ok" ? "good" : "warn"}">预测市场：${escapeHtml(polymarketStatus)}</span>
    <span class="status-chip">自动刷新 ${escapeHtml(formatRefreshPolicySummary())}</span>
  `;
}

export function renderFilterBar(filters) {
  const container = document.querySelector("#filter-bar");
  container.innerHTML = `
    <div class="filter-group">
      <label class="filter-label">视图</label>
      <select class="filter-select" data-filter="view">
        <option value="recommended" ${filters.view === "recommended" ? "selected" : ""}>推荐信号</option>
        <option value="edge5" ${filters.view === "edge5" ? "selected" : ""}>分歧 ≥ 5</option>
        <option value="all" ${filters.view === "all" ? "selected" : ""}>全部</option>
      </select>
    </div>
    <div class="filter-group">
      <label class="filter-label">时间</label>
      <select class="filter-select" data-filter="when">
        <option value="all" ${filters.when === "all" ? "selected" : ""}>全部</option>
        <option value="today" ${filters.when === "today" ? "selected" : ""}>今日</option>
        <option value="tomorrow" ${filters.when === "tomorrow" ? "selected" : ""}>明日</option>
        <option value="48h" ${filters.when === "48h" ? "selected" : ""}>48 小时内</option>
      </select>
    </div>
    <div class="filter-group">
      <label class="filter-label">排序</label>
      <select class="filter-select" data-filter="sort">
        <option value="confidence" ${filters.sort === "confidence" ? "selected" : ""}>置信度</option>
        <option value="edge" ${filters.sort === "edge" ? "selected" : ""}>分歧</option>
        <option value="date" ${filters.sort === "date" ? "selected" : ""}>开赛时间</option>
      </select>
    </div>
    <button type="button" class="filter-apply-btn" id="filter-reset-btn">重置</button>
  `;
}

export function renderMatchdayStrip(buckets, activeKey) {
  const container = document.querySelector("#matchday-strip");
  const allActive = activeKey === null ? "matchday-card-active" : "";

  container.innerHTML = `
    <button type="button" class="matchday-card ${allActive}" data-matchday="">
      <span class="matchday-label">全部</span>
      <strong>—</strong>
    </button>
    ${buckets
      .map(
        (bucket) => `
        <button type="button" class="matchday-card ${activeKey === bucket.key ? "matchday-card-active" : ""}" data-matchday="${escapeHtml(bucket.key)}">
          <span class="matchday-label">${escapeHtml(bucket.key)}</span>
          <strong>${bucket.count} 场</strong>
          <span class="matchday-meta">${bucket.lowConfidence} 场高分歧</span>
        </button>
      `,
      )
      .join("")}
  `;
}

export function renderTopEdgeStrip(predictions) {
  const container = document.querySelector("#top-edge-strip");
  const topItems = [...predictions]
    .sort((a, b) => computeDisagreement(b) - computeDisagreement(a))
    .slice(0, 5);

  if (!topItems.length) {
    container.innerHTML = `<p class="empty-note">暂无价值信号</p>`;
    return;
  }

  container.innerHTML = topItems
    .map((item) => {
      const score = computeConfidenceScore(item);
      const edge = computeDisagreement(item).toFixed(1);
      return `
        <article class="top-edge-card">
          <div class="conf-ring">${score}<span>置信</span></div>
          <div class="top-edge-body">
            <strong>${escapeHtml(item.fixture)}</strong>
            <span class="top-edge-meta">${escapeHtml(formatConfidence(item.confidence))} · 分歧 ${edge}</span>
            <span class="top-edge-edge">+${edge} pp</span>
          </div>
        </article>
      `;
    })
    .join("");
}
