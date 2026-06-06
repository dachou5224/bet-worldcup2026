import { escapeHtml, formatKickoff, formatConfidence } from "../format.js";
import { getSpotlightLeanLabel } from "../schedule.js";
import { computeConfidenceScore, getSignalTier, getConfidenceTone } from "../metrics.js";

function getRowKey(match) {
  return `${match.kind}-${match.id}`;
}

export function renderScheduleSpotlight(spotlight, windowDays = 3) {
  const container = document.querySelector("#schedule-spotlight");
  const summary = document.querySelector("#schedule-spotlight-summary");
  const matches = Array.isArray(spotlight) ? spotlight : spotlight.matches;
  const meta = Array.isArray(spotlight)
    ? { mode: "primary", windowDays }
    : spotlight.meta || { mode: "primary", windowDays };

  if (!matches.length) {
    summary.textContent = `未来 ${meta.windowDays || windowDays} 天暂无重点赛程，请稍后刷新或查看比赛盘面。`;
    container.innerHTML = `<p class="empty-note">未来 ${meta.windowDays || windowDays} 天内没有可展示的比赛。</p>`;
    return;
  }

  if (meta.mode === "fallback") {
    summary.textContent = `未来 ${meta.windowDays} 天内暂无赛程，已展示 ${meta.fallbackDays} 日内 ${matches.length} 场重点比赛`;
  } else if (meta.mode === "nearest") {
    summary.textContent = `未来 ${meta.windowDays} 天内暂无赛程，已展示最近 ${matches.length} 场待赛`;
  } else {
    summary.textContent = `共 ${matches.length} 场重点比赛 · 从今天起 ${meta.windowDays || windowDays} 天`;
  }

  container.innerHTML = matches
    .map((match) => {
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
          <strong class="schedule-fixture">${escapeHtml(match.home)} vs ${escapeHtml(match.away)}</strong>
          <span class="schedule-meta">${escapeHtml(match.stage || "世界杯")} · ${escapeHtml(match.status || "待开赛")}</span>
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
    })
    .join("");
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
