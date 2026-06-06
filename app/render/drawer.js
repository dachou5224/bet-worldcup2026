import { escapeHtml, formatKickoff, formatRegion, formatConfidence } from "../format.js";
import {
  computeDisagreement,
  computeConfidenceScore,
  getSignalTier,
  getConfidenceTone,
} from "../metrics.js";

export function renderMatchDrawer(selection) {
  const drawer = document.querySelector("#match-drawer");
  const backdrop = document.querySelector("#drawer-backdrop");
  if (!selection) {
    drawer.classList.add("hidden");
    backdrop.classList.add("hidden");
    drawer.innerHTML = "";
    return;
  }

  const { match, prediction, normalized, analysisItems } = selection;
  const score = prediction ? computeConfidenceScore(prediction) : null;
  const tier = prediction ? getSignalTier(prediction) : null;
  const opinions = normalized?.expertOpinions || prediction?.expertOpinions || [];
  const llmText = prediction?.llm || analysisItems?.[0]?.text || "";
  const jingcai = prediction?.jingcaiRecommendation?.primaryRecommendation || null;
  const layeredText = prediction?.layeredOutput?.textSummary || prediction?.summary || "";

  drawer.innerHTML = `
    <div class="drawer-header">
      <div>
        <p class="section-kicker">比赛详情</p>
        <h2>${escapeHtml(match.fixture || `${match.home} vs ${match.away}`)}</h2>
        <p class="meta-line">${escapeHtml(formatKickoff(match.kickoff))} · ${escapeHtml(match.stage || "")} · ${escapeHtml(match.status || "")}</p>
      </div>
      <button type="button" class="drawer-close" id="drawer-close" aria-label="关闭">×</button>
    </div>
    ${
      prediction
        ? `
      <div class="drawer-section">
        <h3>模型 vs 市场</h3>
        <div class="drawer-badges">
          ${score != null ? `<span class="conf-badge">${score}<small>/100</small></span>` : ""}
          ${tier ? `<span class="tier-badge tier-${tier.tone}">${tier.label}</span>` : ""}
          <span class="source-badge source-badge-${getConfidenceTone(prediction.confidence)}">${escapeHtml(formatConfidence(prediction.confidence))}</span>
          <span class="edge-badge">分歧 ${computeDisagreement(prediction).toFixed(1)}</span>
        </div>
        <div class="signal-prob-grid">
          <div class="prob-compare-col">
            <span class="prob-col-title">市场</span>
            <div class="prob-triplet">
              <span>主 ${prediction.marketHome}%</span>
              <span>平 ${prediction.marketDraw}%</span>
              <span>客 ${prediction.marketAway}%</span>
            </div>
          </div>
          <div class="prob-compare-col">
            <span class="prob-col-title">模型</span>
            <div class="prob-triplet">
              <span>主 ${prediction.modelHome}%</span>
              <span>平 ${prediction.modelDraw}%</span>
              <span>客 ${prediction.modelAway}%</span>
            </div>
          </div>
        </div>
        <p class="body-text">${escapeHtml(layeredText)}</p>
      </div>
    `
        : `<p class="empty-note">该场次暂无预测信号。</p>`
    }
    ${
      jingcai
        ? `
      <div class="drawer-section">
        <h3>体彩建议</h3>
        <div class="drawer-badges">
          <span class="source-badge source-badge-good">${escapeHtml(jingcai.playType)} · ${escapeHtml(jingcai.selection)}</span>
          <span class="edge-badge">官方 EV ${(jingcai.officialExpectedValue * 100).toFixed(1)}%</span>
          <span class="source-badge">${escapeHtml(jingcai.recommendationLevel)}</span>
        </div>
        <p class="body-text">${escapeHtml(jingcai.recommendationText || "")}</p>
      </div>
    `
        : ""
    }
    ${
      opinions.length
        ? `
      <div class="drawer-section">
        <h3>专家观点</h3>
        <div class="opinion-stack">
          ${opinions
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
      </div>
    `
        : ""
    }
    ${
      llmText
        ? `
      <div class="drawer-section">
        <h3>分析摘要</h3>
        <p class="body-text">${escapeHtml(llmText)}</p>
      </div>
    `
        : ""
    }
    ${
      normalized?.providers
        ? `
      <div class="drawer-section">
        <h3>盘口覆盖</h3>
        <div class="drawer-meta-grid">
          <span>赔率源 ${normalized.providers.oddsCount}</span>
          <span>预测市场 ${normalized.providers.predictionMarketCount}</span>
          <span>让球 ${normalized.providers.spreadsCount}</span>
          <span>大小球 ${normalized.providers.totalsCount}</span>
        </div>
      </div>
    `
        : ""
    }
  `;

  drawer.classList.remove("hidden");
  backdrop.classList.remove("hidden");
}

export function renderDataQualityPanel(qualityReport, providerCoverage) {
  const container = document.querySelector("#data-quality-panel");
  if (!qualityReport) {
    container.innerHTML = `<p class="empty-note">数据质量报告暂不可用。</p>`;
    return;
  }

  const topIssues = (qualityReport.issues || []).slice(0, 4);
  const providers = providerCoverage?.providers || [];

  container.innerHTML = `
    <div class="quality-summary">
      <div class="quality-stat">
        <span class="quality-label">Schema</span>
        <strong class="${qualityReport.schemaOk ? "quality-good" : "quality-bad"}">${qualityReport.schemaOk ? "通过" : "异常"}</strong>
      </div>
      <div class="quality-stat">
        <span class="quality-label">告警</span>
        <strong>${qualityReport.issueCount || 0}</strong>
      </div>
      <div class="quality-stat">
        <span class="quality-label">场次</span>
        <strong>${qualityReport.matchCount || 0}</strong>
      </div>
    </div>
    ${
      topIssues.length
        ? `
      <ul class="quality-issues">
        ${topIssues
          .map(
            (issue) => `
          <li class="quality-issue quality-${issue.severity}">
            <strong>${escapeHtml(issue.fixture)}</strong>
            <span>${escapeHtml(issue.message)}</span>
          </li>
        `,
          )
          .join("")}
      </ul>
    `
        : `<p class="body-text">当前没有高优先级数据告警。</p>`
    }
    ${
      providers.length
        ? `
      <div class="coverage-list">
        <h3 class="coverage-title">Provider 覆盖</h3>
        ${providers
          .slice(0, 5)
          .map(
            (provider) => `
          <div class="coverage-row">
            <span>${escapeHtml(provider.name)}</span>
            <strong>${provider.fixtures} 场</strong>
          </div>
        `,
          )
          .join("")}
      </div>
    `
        : ""
    }
  `;
}

export function setLoading(isLoading) {
  document.querySelector("#loading-overlay")?.classList.toggle("hidden", !isLoading);
}
