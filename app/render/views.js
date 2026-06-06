import { escapeHtml, formatKickoff, formatDateGroupHeader, formatRegion, formatConfidence } from "../format.js";
import {
  computeDisagreement,
  computeConfidenceScore,
  summarizeLean,
  getTopEdgeOutcome,
  computeFairOdd,
  getSignalTier,
  getConfidenceTone,
} from "../metrics.js";

import { extractMarketLines, renderMarketPills } from "../markets.js";
import { findNormalizedForMatch } from "../fixture-match.js";

function getRowKey(match) {
  return `${match.kind}-${match.id}`;
}

export function renderSignalList(predictions) {
  const container = document.querySelector("#signal-list");

  if (!predictions.length) {
    container.innerHTML = `<p class="empty-note">当前筛选条件下没有信号，试试放宽视图或时间范围。</p>`;
    return;
  }

  container.innerHTML = predictions
    .map((item) => {
      const score = computeConfidenceScore(item);
      const edge = computeDisagreement(item);
      const topOutcome = getTopEdgeOutcome(item);
      const marketLean = summarizeLean(item, "market");
      const modelLean = summarizeLean(item, "model");
      const tier = getSignalTier(item);
      const fairOdd = computeFairOdd(modelLean.value);
      const rowKey = `prediction-${item.id}`;

      return `
        <article class="signal-row" data-open-drawer="${escapeHtml(rowKey)}" role="button" tabindex="0">
          <div class="signal-row-head">
            <div class="signal-row-title">
              <strong>${escapeHtml(item.fixture)}</strong>
              <span class="signal-row-meta">${escapeHtml(formatKickoff(item.kickoff))} · ${escapeHtml(item.freshness || "")}</span>
            </div>
            <div class="signal-row-badges">
              <span class="conf-badge">${score}<small>/100</small></span>
              <span class="tier-badge tier-${tier.tone}">${tier.label}</span>
              <span class="source-badge source-badge-${getConfidenceTone(item.confidence)}">${escapeHtml(formatConfidence(item.confidence))}</span>
            </div>
          </div>
          <div class="signal-pick-line">
            <span class="signal-pick">${escapeHtml(topOutcome.label)} · 市场 ${topOutcome.market}% → 模型 ${topOutcome.model}%</span>
            <span class="edge-badge">+${(topOutcome.model - topOutcome.market).toFixed(1)} pp</span>
          </div>
          <div class="signal-metrics">
            <div class="metric-cell">
              <span class="metric-label">模型</span>
              <strong>${modelLean.value}%</strong>
              <span class="metric-sub">${escapeHtml(modelLean.label)}</span>
            </div>
            <div class="metric-cell">
              <span class="metric-label">市场</span>
              <strong>${marketLean.value}%</strong>
              <span class="metric-sub">${escapeHtml(marketLean.label)}</span>
            </div>
            <div class="metric-cell metric-edge">
              <span class="metric-label">分歧</span>
              <strong>+${edge.toFixed(1)}</strong>
              <span class="metric-sub">pp 合计</span>
            </div>
            <div class="metric-cell">
              <span class="metric-label">公平赔率</span>
              <strong>${fairOdd}</strong>
              <span class="metric-sub">模型隐含</span>
            </div>
          </div>
          <div class="signal-prob-grid">
            <div class="prob-compare-col">
              <span class="prob-col-title">市场</span>
              <div class="prob-triplet">
                <span>主 ${item.marketHome}%</span>
                <span>平 ${item.marketDraw}%</span>
                <span>客 ${item.marketAway}%</span>
              </div>
            </div>
            <div class="prob-compare-col">
              <span class="prob-col-title">模型</span>
              <div class="prob-triplet">
                <span>主 ${item.modelHome}%</span>
                <span>平 ${item.modelDraw}%</span>
                <span>客 ${item.modelAway}%</span>
              </div>
            </div>
          </div>
          <p class="signal-explain">${escapeHtml(item.summary)}</p>
          <button type="button" class="row-detail-btn" data-open-drawer="${escapeHtml(rowKey)}">查看详情</button>
        </article>
      `;
    })
    .join("");
}

export function renderMatchDayGroups(unifiedMatches, normalizedLookup, marketTabByRow) {
  const container = document.querySelector("#live-match-list");

  if (!unifiedMatches.length) {
    container.innerHTML = `<p class="empty-note">当前筛选下没有赛程条目。</p>`;
    return;
  }

  const byDate = new Map();
  for (const match of unifiedMatches) {
    const header = formatDateGroupHeader(match.kickoff);
    const list = byDate.get(header) || [];
    list.push(match);
    byDate.set(header, list);
  }

  container.innerHTML = [...byDate.entries()]
    .map(([dateHeader, dayMatches]) => {
      const rows = dayMatches
        .map((match) => {
          const rowKey = getRowKey(match);
          const marketTab = marketTabByRow[rowKey] || "h2h";
          const normalized =
            findNormalizedForMatch(match, normalizedLookup) ||
            (match.prediction ? normalizedLookup.get(match.prediction.fixture) : null);
          const marketLines = extractMarketLines(normalized);
          const pills = renderMarketPills(marketTab, match.prediction, marketLines);
          const kindBadge =
            match.kind === "prediction-only"
              ? `<span class="source-badge source-badge-warn">仅预测</span>`
              : "";

          return `
            <article class="match-row" data-open-drawer="${escapeHtml(rowKey)}" data-row-key="${escapeHtml(rowKey)}">
              <div class="match-row-time">
                <strong>${escapeHtml(formatKickoff(match.kickoff))}</strong>
                <span>${escapeHtml(match.stage)} ${kindBadge}</span>
              </div>
              <div class="match-row-teams">
                <strong>${escapeHtml(match.home)}</strong>
                <span class="match-score-inline">${escapeHtml(match.homeScore)} : ${escapeHtml(match.awayScore)}</span>
                <strong>${escapeHtml(match.away)}</strong>
              </div>
              <div class="match-row-markets">
                <div class="market-tabs" data-row-key="${escapeHtml(rowKey)}">
                  <button type="button" class="market-tab ${marketTab === "h2h" ? "market-tab-active" : ""}" data-market-tab="h2h">胜负线</button>
                  <button type="button" class="market-tab ${marketTab === "spread" ? "market-tab-active" : ""}" data-market-tab="spread">让分</button>
                  <button type="button" class="market-tab ${marketTab === "total" ? "market-tab-active" : ""}" data-market-tab="total">总分</button>
                </div>
                ${pills}
              </div>
              <div class="match-row-status">
                <span class="match-state">${escapeHtml(match.status)}</span>
                <span class="match-footnote">${escapeHtml(match.note || match.venue || "")}</span>
                <button type="button" class="row-detail-btn" data-open-drawer="${escapeHtml(rowKey)}">详情</button>
              </div>
            </article>
          `;
        })
        .join("");

      return `
        <section class="date-group">
          <h3 class="date-group-header">${escapeHtml(dateHeader)}</h3>
          ${rows}
        </section>
      `;
    })
    .join("");
}

export function renderLiveToolbar(activeFilter) {
  const container = document.querySelector("#live-toolbar");
  const filters = [
    { id: "focus", label: "焦点赛程" },
    { id: "prematch", label: "赛前列表" },
    { id: "finished", label: "已完赛复盘" },
  ];

  container.innerHTML = filters
    .map(
      (filter) => `
      <button type="button" class="filter-chip ${activeFilter === filter.id ? "filter-chip-active" : ""}" data-live-filter="${filter.id}">
        ${escapeHtml(filter.label)}
      </button>
    `,
    )
    .join("");
}

export function renderProviderPanel(data) {
  const providerHealth = data.providerHealth || {};
  document.querySelector("#provider-indicator-grid").innerHTML = [
    {
      label: "赔率接入",
      value: providerHealth.oddsStatus === "ok" ? "在线" : "异常",
      meta: providerHealth.oddsRows ? `${providerHealth.oddsRows} 场` : "等待数据",
      tone: providerHealth.oddsStatus === "ok" ? "good" : "warn",
    },
    {
      label: "实时赛程",
      value: data.liveDataMode === "real" ? "真实流" : "模拟",
      meta: `${data.liveMatches.length} 条`,
      tone: data.liveDataMode === "real" ? "good" : "warn",
    },
    {
      label: "预测市场",
      value: providerHealth.polymarketStatus === "ok" ? "已接入" : "未启用",
      meta: providerHealth.polymarketRows ? `${providerHealth.polymarketRows} 条` : "—",
      tone: providerHealth.polymarketStatus === "ok" ? "good" : "neutral",
    },
    {
      label: "高分歧",
      value: `${data.tomorrowPredictions.filter((item) => item.confidence === "low").length} 场`,
      meta: "需重点复盘",
      tone: "warn",
    },
  ]
    .map(
      (item) => `
      <article class="indicator-card indicator-card-${item.tone}">
        <span class="indicator-label">${escapeHtml(item.label)}</span>
        <strong class="indicator-value">${escapeHtml(item.value)}</strong>
        <span class="indicator-meta">${escapeHtml(item.meta)}</span>
      </article>
    `,
    )
    .join("");

  document.querySelector("#market-source-list").innerHTML = (data.marketSources || [])
    .map(
      (source) => `
      <article class="source-card">
        <div class="source-header">
          <strong>${escapeHtml(source.name)}</strong>
          <span class="source-badge">${escapeHtml(source.typeLabel || source.type)}</span>
        </div>
        <div class="source-value">${escapeHtml(source.value)}</div>
        <div class="source-meta">${escapeHtml(source.detail)}</div>
      </article>
    `,
    )
    .join("");
}

export function renderReviewSections(data) {
  document.querySelector("#comparison-list").innerHTML = (data.completedComparisons || [])
    .map(
      (item) => `
      <article class="comparison-card">
        <div class="card-head-row">
          <div>
            <strong>${escapeHtml(item.fixture)}</strong>
            <div class="meta-line">赛后复盘</div>
          </div>
          <span class="${item.status === "hit" ? "status-good" : "status-watch"}">
            ${item.status === "hit" ? "预测命中" : "需要复盘"}
          </span>
        </div>
        <div class="comparison-grid">
          <div class="comparison-box"><span class="comparison-label">预测</span><strong>${escapeHtml(item.predicted)}</strong></div>
          <div class="comparison-box"><span class="comparison-label">实际</span><strong>${escapeHtml(item.actual)}</strong></div>
          <div class="comparison-box"><span class="comparison-label">偏差</span><strong>${escapeHtml(item.edge)}</strong></div>
        </div>
        <p class="body-text">${escapeHtml(item.takeaway)}</p>
      </article>
    `,
    )
    .join("");

  document.querySelector("#opinion-list").innerHTML = (data.expertOpinions || [])
    .map(
      (group) => `
      <article class="opinion-card">
        <strong>${escapeHtml(group.fixture)}</strong>
        <div class="opinion-stack">
          ${group.opinions
            .map(
              (opinion) => `
            <div class="opinion-entry">
              <strong>${escapeHtml(opinion.pundit)}</strong>
              <div class="meta-line">${escapeHtml(formatRegion(opinion.region))} · ${escapeHtml(formatConfidence(opinion.confidence))}</div>
              <p class="body-text">${escapeHtml(opinion.summary)}</p>
            </div>
          `,
            )
            .join("")}
        </div>
      </article>
    `,
    )
    .join("");

  document.querySelector("#analysis-list").innerHTML = (data.analysisItems || [])
    .map(
      (item) => `
      <article class="analysis-card">
        <div class="meta-line">${escapeHtml(item.meta)}</div>
        <h3 class="card-title">${escapeHtml(item.title)}</h3>
        <p class="body-text">${escapeHtml(item.text)}</p>
      </article>
    `,
    )
    .join("");

  document.querySelector("#method-list").innerHTML = (data.modelingSteps || [])
    .map(
      (item) => `
      <li class="method-card">
        <span class="method-step">${escapeHtml(item.step)}</span>
        <strong>${escapeHtml(item.title)}</strong>
        <p class="body-text">${escapeHtml(item.text)}</p>
      </li>
    `,
    )
    .join("");
}

export function renderHowComputed(steps) {
  const container = document.querySelector("#how-computed-body");
  container.innerHTML = (steps || [])
    .map(
      (item) => `
      <li>
        <strong>${escapeHtml(item.title)}</strong>
        <span>${escapeHtml(item.text)}</span>
      </li>
    `,
    )
    .join("");
}
