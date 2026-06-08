import { escapeHtml, formatKickoff, formatConfidence } from "../format.js";
import { formatWeekHeading, getSpotlightLeanLabel } from "../schedule.js";
import { computeConfidenceScore, getSignalTier, getConfidenceTone } from "../metrics.js";
import {
  renderMatchFixture,
  renderMatchStageChips,
  renderMatchStageMeta,
  renderMatchStatusLine,
} from "./match-stage.js";

function getRowKey(match) {
  return `${match.kind}-${match.id}`;
}

function renderScheduleCard(match) {
  const rowKey = getRowKey(match);
  const prediction = match.prediction;
  const score = prediction ? computeConfidenceScore(prediction) : null;
  const tier = prediction ? getSignalTier(prediction) : null;
  const leanLine = getSpotlightLeanLabel(match);

  return `
    <article class="schedule-card" data-open-drawer="${escapeHtml(rowKey)}">
      <div class="schedule-card-top">
        <span class="schedule-time">${escapeHtml(formatKickoff(match.kickoff))}</span>
        ${tier ? `<span class="tier-badge tier-${tier.tone}">${tier.label}</span>` : ""}
      </div>
      <strong class="schedule-fixture">${renderMatchFixture(match, { width: 40 })}</strong>
      ${renderMatchStageChips(match)}
      <span class="schedule-meta">${escapeHtml(renderMatchStatusLine(match))}</span>
      ${
        prediction
          ? `
        <div class="schedule-prob-row">
          <span>主 ${prediction.marketHome}%</span>
          <span>平 ${prediction.marketDraw}%</span>
          <span>客 ${prediction.marketAway}%</span>
        </div>
        <div class="schedule-card-foot">
          <span class="source-badge source-badge-${getConfidenceTone(prediction.confidence)}">${escapeHtml(formatConfidence(prediction.confidence))}</span>
          ${score != null ? `<span class="schedule-score">${score} 分</span>` : ""}
        </div>
      `
          : `<span class="schedule-meta">暂无预测盘面</span>`
      }
      <p class="schedule-lean">${escapeHtml(leanLine)}</p>
      <button type="button" class="row-detail-btn" data-open-drawer="${escapeHtml(rowKey)}">查看详情</button>
    </article>
  `;
}

function renderFullScheduleRow(match) {
  const rowKey = getRowKey(match);
  return `
    <button type="button" class="schedule-full-row" data-open-drawer="${escapeHtml(rowKey)}">
      <span class="schedule-full-time">${escapeHtml(formatKickoff(match.kickoff))}</span>
      <span class="schedule-full-fixture">${renderMatchFixture(match, { width: 20 })}</span>
      <span class="schedule-full-stage">${escapeHtml(renderMatchStageMeta(match))}</span>
    </button>
  `;
}

export function renderScheduleFullDropdown(groups) {
  const container = document.querySelector("#schedule-full-list");
  if (!container) {
    return;
  }

  if (!groups.length) {
    container.innerHTML = `<p class="empty-note">暂无完整赛程，请稍后刷新或查看比赛盘面。</p>`;
    return;
  }

  container.innerHTML = groups
    .map(
      (group) => `
      <section class="schedule-full-group">
        <h3 class="schedule-full-date">${escapeHtml(group.label)}</h3>
        <div class="schedule-full-rows">
          ${group.matches.map(renderFullScheduleRow).join("")}
        </div>
      </section>
    `,
    )
    .join("");
}

export function renderScheduleWeekRail(weeks, selectedWeekIndex, defaultWeekIndex) {
  const container = document.querySelector("#schedule-week-rail");
  if (!container) {
    return;
  }

  if (!weeks.length) {
    container.innerHTML = "";
    return;
  }

  container.innerHTML = weeks
    .map((week) => {
      const isActive = week.weekIndex === selectedWeekIndex;
      const isCurrent = week.weekIndex === defaultWeekIndex;
      return `
        <button
          type="button"
          class="schedule-week-chip ${isActive ? "schedule-week-chip-active" : ""}"
          data-week-index="${week.weekIndex}"
          aria-pressed="${isActive ? "true" : "false"}"
        >
          <span class="schedule-week-label">${escapeHtml(week.label)}${isCurrent ? " · 本周" : ""}</span>
          <span class="schedule-week-range">${escapeHtml(week.rangeLabel)}</span>
        </button>
      `;
    })
    .join("");
}

export function renderScheduleSpotlight(spotlight) {
  const container = document.querySelector("#schedule-spotlight");
  const summary = document.querySelector("#schedule-spotlight-summary");
  const title = document.querySelector("#schedule-week-title");
  const note = document.querySelector("#schedule-week-note");

  const matches = spotlight.matches || [];
  const meta = spotlight.meta || {};
  const weeks = spotlight.weeks || [];

  if (title && meta.weekNumber) {
    const week = weeks.find((item) => item.weekIndex === meta.weekIndex) || weeks[0];
    title.textContent = week ? formatWeekHeading(week, { isCurrent: meta.isCurrentWeek }) : "本周重点比赛";
  }

  if (note && meta.rangeLabel) {
    note.textContent = `开幕 ${meta.openingDate || "2026-06-11"} 起 · ${meta.rangeLabel} · 北京时间 · 按信号强度排序`;
  }

  if (!matches.length) {
    summary.textContent = meta.totalInWeek
      ? `第 ${meta.weekNumber} 周暂无重点场次，可在上方展开完整赛程。`
      : `第 ${meta.weekNumber} 周（${meta.rangeLabel || ""}）暂无赛程数据，请展开「世界杯赛程」或切换其他周。`;
    container.innerHTML = `<p class="empty-note">该周暂无比赛数据，试试切换周次或查看比赛盘面。</p>`;
    return;
  }

  summary.textContent = `第 ${meta.weekNumber} 周 · ${meta.rangeLabel} · 展示 ${matches.length} / ${meta.totalInWeek} 场`;
  container.innerHTML = matches.map(renderScheduleCard).join("");
}

export function renderScheduleDayRail(buckets) {
  const container = document.querySelector("#schedule-day-rail");
  if (!buckets.length) {
    container.innerHTML = "";
    return;
  }

  container.innerHTML = buckets
    .map(
      ([label, dayMatches]) => `
      <div class="schedule-day-chip">
        <span class="schedule-day-label">${escapeHtml(label)}</span>
        <strong>${dayMatches.length} 场</strong>
      </div>
    `,
    )
    .join("");
}
