function formatTimestamp(date) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

function formatConfidence(value) {
  return value === "high" ? "高置信" : value === "medium" ? "中置信" : "低置信";
}

function formatRegion(value) {
  return value === "CN" ? "中文区" : value === "Global" ? "海外" : value;
}

function formatMode(mode) {
  const map = {
    mock: "模拟数据",
    file: "文件数据",
    real: "真实数据",
    real_fallback_mock: "真实回退模拟",
    real_unconfigured_fallback_mock: "未配置回退模拟",
  };
  return map[mode] || mode;
}

function computeDisagreement(item) {
  return (
    Math.abs(item.marketHome - item.modelHome) +
    Math.abs(item.marketDraw - item.modelDraw) +
    Math.abs(item.marketAway - item.modelAway)
  );
}

function formatKickoff(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(parsed);
}

function formatMatchdayKey(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "时间待定";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).format(parsed);
}

function getConfidenceTone(value) {
  return value === "high" ? "good" : value === "medium" ? "neutral" : "warn";
}

function summarizeLean(item, prefix) {
  const values = [
    { key: "主", value: item[`${prefix}Home`] },
    { key: "平", value: item[`${prefix}Draw`] },
    { key: "客", value: item[`${prefix}Away`] },
  ].sort((a, b) => b.value - a.value);

  return `${values[0].key} ${values[0].value}%`;
}

function buildCompactInsight(item) {
  const difference = computeDisagreement(item).toFixed(1);
  return `市场 ${summarizeLean(item, "market")} / 模型 ${summarizeLean(item, "model")} / 分歧 ${difference}`;
}

function setStatusMessage(message, isError = false) {
  const node = document.querySelector("#last-updated");
  node.textContent = message;
  node.classList.toggle("pill-error", isError);
}

function renderLiveMatches(matches) {
  const container = document.querySelector("#live-match-list");
  container.innerHTML = matches.slice(0, 14)
    .map(
      (match) => `
        <article class="match-card">
          <div class="match-main">
            <div>
              <div class="match-topline">
                <strong>${match.home}</strong>
                <span class="match-versus">vs</span>
                <strong>${match.away}</strong>
              </div>
              <div class="match-meta">${match.stage} · ${formatKickoff(match.kickoff)} · ${match.venue}</div>
            </div>
            <div class="score-stack">
              <span class="match-score">${match.homeScore}</span>
              <span class="match-score-divider">:</span>
              <span class="match-score">${match.awayScore}</span>
            </div>
          </div>
          <div class="match-subline">
            <span class="match-state">${match.status}</span>
            <span class="match-footnote">${match.note}</span>
          </div>
        </article>
      `,
    )
    .join("");
}

function renderPredictions(predictions) {
  const container = document.querySelector("#prediction-list");
  const focusPredictions = [...predictions]
    .sort((a, b) => computeDisagreement(b) - computeDisagreement(a))
    .slice(0, 10);

  container.innerHTML = focusPredictions
    .map(
      (item) => `
        <article class="prediction-card">
          <div class="prediction-card-top">
            <div class="prediction-match">
              <strong>${item.fixture}</strong>
              <div class="prediction-meta">${formatKickoff(item.kickoff)}</div>
            </div>
            <div class="board-status">
              <span class="source-badge source-badge-${getConfidenceTone(item.confidence)}">${formatConfidence(item.confidence)}</span>
              <span class="disagreement-pill">分歧 ${computeDisagreement(item).toFixed(1)}</span>
            </div>
          </div>
          <div class="price-triplet">
            <div class="price-cell">
              <span class="probability-label">主</span>
              <strong class="probability">${item.marketHome}%</strong>
            </div>
            <div class="price-cell">
              <span class="probability-label">平</span>
              <strong class="probability">${item.marketDraw}%</strong>
            </div>
            <div class="price-cell">
              <span class="probability-label">客</span>
              <strong class="probability">${item.marketAway}%</strong>
            </div>
          </div>
          <div class="model-strip">
            <div class="model-chip">市场倾向 ${summarizeLean(item, "market")}</div>
            <div class="model-chip">模型倾向 ${summarizeLean(item, "model")}</div>
          </div>
          <div class="prediction-divider"></div>
          <div class="prediction-brief">
            <p class="prediction-summary">${buildCompactInsight(item)}</p>
            <p class="analysis-text">${item.summary}</p>
            <p class="analysis-text analysis-text-muted">刷新于 ${item.freshness}</p>
          </div>
        </article>
      `,
    )
    .join("");
}

function renderPredictionSummary(predictions) {
  const container = document.querySelector("#prediction-summary-bar");
  const lowConfidenceCount = predictions.filter((item) => item.confidence === "low").length;
  const topDisagreement = [...predictions]
    .sort((a, b) => computeDisagreement(b) - computeDisagreement(a))[0];
  container.innerHTML = `
    <span class="summary-chip">${predictions.length} 场盘面</span>
    <span class="summary-chip">${lowConfidenceCount} 场高分歧</span>
    <span class="summary-chip">最高分歧：${topDisagreement ? topDisagreement.fixture : "暂无"}</span>
  `;
}

function renderPredictionFocus(predictions) {
  const container = document.querySelector("#prediction-focus-bar");
  const focusFixtures = [...predictions]
    .sort((a, b) => computeDisagreement(b) - computeDisagreement(a))
    .slice(0, 3)
    .map((item) => `${item.fixture} · ${computeDisagreement(item).toFixed(1)}`);

  container.innerHTML = focusFixtures
    .map((fixture) => `<span class="status-chip">${fixture}</span>`)
    .join("");
}

function renderMatchdayStrip(predictions) {
  const container = document.querySelector("#matchday-strip");
  const buckets = new Map();

  for (const item of predictions) {
    const key = formatMatchdayKey(item.kickoff);
    const current = buckets.get(key) || { key, count: 0, lowConfidence: 0 };
    current.count += 1;
    if (item.confidence === "low") {
      current.lowConfidence += 1;
    }
    buckets.set(key, current);
  }

  container.innerHTML = Array.from(buckets.values())
    .slice(0, 6)
    .map(
      (bucket, index) => `
        <article class="matchday-card ${index === 0 ? "matchday-card-active" : ""}">
          <span class="matchday-label">${bucket.key}</span>
          <strong>${bucket.count} 场</strong>
          <span class="matchday-meta">${bucket.lowConfidence} 场高分歧</span>
        </article>
      `,
    )
    .join("");
}

function renderSourceStatus(data) {
  const container = document.querySelector("#source-status-bar");
  const providerHealth = data.providerHealth || {};
  const oddsStatus = providerHealth.oddsStatus || (providerHealth.source === "mock" ? "mock" : "unknown");
  const polymarketStatus = providerHealth.polymarketStatus || "skipped";

  container.innerHTML = `
    <span class="status-chip status-chip-good">市场模式：${formatMode(data.marketDataMode || "mock")}</span>
    <span class="status-chip status-chip-good">实时模式：${formatMode(data.liveDataMode || "mock")}</span>
    <span class="status-chip ${oddsStatus === "ok" ? "status-chip-good" : "status-chip-warn"}">赔率源：${oddsStatus}</span>
    <span class="status-chip ${polymarketStatus === "ok" ? "status-chip-good" : "status-chip-warn"}">Polymarket：${polymarketStatus}</span>
  `;
}

function renderMarketPulse(data) {
  const container = document.querySelector("#market-pulse-bar");
  const predictions = data.tomorrowPredictions || [];
  const lowConfidenceCount = predictions.filter((item) => item.confidence === "low").length;
  const topDisagreement = [...predictions]
    .sort((a, b) => computeDisagreement(b) - computeDisagreement(a))[0];

  container.innerHTML = `
    <span class="pulse-card">
      <span class="pulse-label">盘面节奏</span>
      <strong>${predictions.length} 场已入板</strong>
    </span>
    <span class="pulse-card">
      <span class="pulse-label">预警区</span>
      <strong>${lowConfidenceCount} 场需复盘</strong>
    </span>
    <span class="pulse-card pulse-card-wide">
      <span class="pulse-label">今日最大分歧</span>
      <strong>${topDisagreement ? topDisagreement.fixture : "暂无"}${topDisagreement ? ` · ${computeDisagreement(topDisagreement).toFixed(1)}` : ""}</strong>
    </span>
  `;
}

function renderProviderIndicators(data) {
  const container = document.querySelector("#provider-indicator-grid");
  const providerHealth = data.providerHealth || {};
  const items = [
    {
      label: "赔率接入",
      value: providerHealth.oddsStatus === "ok" ? "在线" : "异常",
      meta: providerHealth.oddsRows ? `${providerHealth.oddsRows} 场赔率` : "等待数据",
      tone: providerHealth.oddsStatus === "ok" ? "good" : "warn",
    },
    {
      label: "实时赛程",
      value: data.liveDataMode === "real" ? "真实流" : formatMode(data.liveDataMode || "mock"),
      meta: `${data.liveMatches.length} 条赛程`,
      tone: data.liveDataMode === "real" ? "good" : "warn",
    },
    {
      label: "预测市场",
      value: providerHealth.polymarketStatus === "ok" ? "已接入" : "暂未启用",
      meta: providerHealth.polymarketRows ? `${providerHealth.polymarketRows} 条` : "当前不参与主链",
      tone: providerHealth.polymarketStatus === "ok" ? "good" : "neutral",
    },
    {
      label: "模型分歧",
      value: `${data.tomorrowPredictions.filter((item) => item.confidence === "low").length} 场`,
      meta: "越高越值得重点看",
      tone: "warn",
    },
  ];

  container.innerHTML = items
    .map(
      (item) => `
        <article class="indicator-card indicator-card-${item.tone}">
          <span class="indicator-label">${item.label}</span>
          <strong class="indicator-value">${item.value}</strong>
          <span class="indicator-meta">${item.meta}</span>
        </article>
      `,
    )
    .join("");
}

function renderSources(sources) {
  const container = document.querySelector("#market-source-list");
  container.innerHTML = sources
    .map(
      (source) => `
        <article class="source-card">
          <div class="source-header">
            <strong>${source.name}</strong>
            <span class="source-badge">${source.typeLabel || source.type}</span>
          </div>
          <div class="source-value">${source.value}</div>
          <div class="source-meta">${source.detail}</div>
        </article>
      `,
    )
    .join("");
}

function renderOpinions(opinionGroups) {
  const container = document.querySelector("#opinion-list");
  container.innerHTML = opinionGroups
    .map(
      (group) => `
        <article class="opinion-card">
          <div class="prediction-header">
            <div>
              <strong>${group.fixture}</strong>
              <div class="prediction-meta">观点池 ${group.opinions.length} 条</div>
            </div>
            <span class="source-badge">专家观点</span>
          </div>
          <div class="opinion-stack">
            ${group.opinions
              .map(
                (opinion) => `
                  <div class="opinion-entry">
                    <strong>${opinion.pundit}</strong>
                    <div class="prediction-meta">${formatRegion(opinion.region)} · ${formatConfidence(opinion.confidence)}</div>
                    <p class="analysis-text">${opinion.summary}</p>
                    <div class="opinion-tags">
                      ${opinion.signalTags
                        .map((tag) => `<span class="opinion-tag">${tag}</span>`)
                        .join("")}
                    </div>
                  </div>
                `,
              )
              .join("")}
          </div>
        </article>
      `,
    )
    .join("");
}

function renderAnalysis(items) {
  const container = document.querySelector("#analysis-list");
  container.innerHTML = items
    .map(
      (item) => `
        <article class="analysis-card">
          <div class="analysis-meta">${item.meta}</div>
          <h3 class="analysis-title">${item.title}</h3>
          <p class="analysis-text">${item.text}</p>
        </article>
      `,
    )
    .join("");
}

function renderComparisons(items) {
  const container = document.querySelector("#comparison-list");
  container.innerHTML = items
    .map(
      (item) => `
        <article class="comparison-card">
          <div class="prediction-header">
            <div>
              <strong>${item.fixture}</strong>
              <div class="prediction-meta">赛后复盘样例</div>
            </div>
            <span class="${item.status === "hit" ? "status-good" : "status-watch"}">
              ${item.status === "hit" ? "预测命中" : "需要复盘"}
            </span>
          </div>
          <div class="comparison-grid">
            <div class="comparison-box">
              <span class="comparison-label">预测结果</span>
              <strong class="comparison-value">${item.predicted}</strong>
            </div>
            <div class="comparison-box">
              <span class="comparison-label">实际结果</span>
              <strong class="comparison-value">${item.actual}</strong>
            </div>
            <div class="comparison-box">
              <span class="comparison-label">概率偏差</span>
              <strong class="comparison-value">${item.edge}</strong>
            </div>
          </div>
          <p class="analysis-text">${item.takeaway}</p>
        </article>
      `,
    )
    .join("");
}

function renderMethod(items) {
  const container = document.querySelector("#method-list");
  container.innerHTML = items
    .map(
      (item) => `
        <li class="method-card">
          <span class="method-step">${item.step}</span>
          <strong>${item.title}</strong>
          <p class="analysis-text">${item.text}</p>
        </li>
      `,
    )
    .join("");
}

function renderStats(data) {
  document.querySelector("#today-match-count").textContent = data.liveMatches.length;
  document.querySelector("#tomorrow-prediction-count").textContent = data.tomorrowPredictions.length;
  document.querySelector("#source-count").textContent = 4;
  document.querySelector("#tournament-status").textContent = data.tournamentStatus;
  setStatusMessage(`刷新于 ${formatTimestamp(new Date(data.lastUpdated))}`);
}

function renderDashboard(data) {
  renderStats(data);
  renderSourceStatus(data);
  renderMarketPulse(data);
  renderLiveMatches(data.liveMatches);
  renderPredictionSummary(data.tomorrowPredictions);
  renderMatchdayStrip(data.tomorrowPredictions);
  renderPredictionFocus(data.tomorrowPredictions);
  renderPredictions(data.tomorrowPredictions);
  renderProviderIndicators(data);
  renderSources(data.marketSources);
  renderOpinions(data.expertOpinions);
  renderComparisons(data.completedComparisons);
  renderAnalysis(data.analysisItems);
  renderMethod(data.modelingSteps);
}

async function fetchDashboardData() {
  const response = await fetch("/api/dashboard", {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Dashboard request failed: ${response.status}`);
  }

  return response.json();
}

async function refreshDashboard() {
  try {
    const data = await fetchDashboardData();
    renderDashboard(data);
  } catch (error) {
    setStatusMessage("API 加载失败，请确认本地服务已启动", true);
    console.error(error);
  }
}

refreshDashboard();
setInterval(refreshDashboard, 30000);
