import { callGeminiGenerateContent, getGeminiConfig } from "./gemini-client.js";

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function formatPercentPoint(value, digits = 2) {
  if (!isFiniteNumber(value)) {
    return "n/a";
  }

  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)} 个百分点`;
}

function formatPercent(value, digits = 2) {
  if (!isFiniteNumber(value)) {
    return "n/a";
  }

  const sign = value > 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(digits)}%`;
}

function labelOutcome(outcome) {
  if (outcome === "home") return "主胜";
  if (outcome === "draw") return "平局";
  if (outcome === "away") return "客胜";
  return String(outcome || "未知");
}

export function buildWatchInterpretationPrompt(signalCandidate) {
  const baseline = signalCandidate?.marketBaseline || {};
  const breakdown = signalCandidate?.watchEdgeBreakdown || {};
  const outcomes = Array.isArray(breakdown.outcomes) ? breakdown.outcomes : [];
  const outcomeLines = outcomes.length
    ? outcomes.map((item) => {
        const label = item.label || labelOutcome(item.outcome);
        return [
          `${label}`,
          `market=${formatPercent(item.marketProbability)}`,
          `model=${formatPercent(item.modelProbability)}`,
          `adjusted=${formatPercent(item.adjustedProbability)}`,
          `edge=${formatPercentPoint(item.edgePercentPoint)}`,
          `EV=${formatPercent(item.expectedValue)}`,
        ].join(", ");
      })
    : [
        `主胜：market=${formatPercent(signalCandidate?.marketProbability)}, model=${formatPercent(signalCandidate?.modelProbability)}, adjusted=${formatPercent(signalCandidate?.adjustedProbability)}, edge=n/a`,
      ];

  return [
    "你是中文体育量化解读助手。请基于下面的结构化数据，输出 1 段 2-3 句的中文解读。",
    "要求：",
    "1) 只能解释为什么是 WATCH，不要给出正式下注建议；",
    "2) 必须自然提到主胜/平局/客胜的 edge 百分点；",
    "3) 语气克制，适合写进业务页面；",
    "4) 不要输出 JSON，不要输出列表，不要引用规则名。",
    "",
    `比赛：${signalCandidate?.fixtureLabel || signalCandidate?.fixture || signalCandidate?.fixtureId || "未知"}`,
    `推荐级别：${signalCandidate?.recommendationLevel || "WATCH"}`,
    `决策码：${signalCandidate?.decisionCode || "unknown"}`,
    `关注方向：${labelOutcome(signalCandidate?.outcome)}`,
    `市场概率：${formatPercent(signalCandidate?.marketProbability)}`,
    `模型概率：${formatPercent(signalCandidate?.modelProbability)}`,
    `收缩后概率：${formatPercent(signalCandidate?.adjustedProbability)}`,
    `当前选项 EV：${formatPercent(signalCandidate?.expectedValue)}`,
    `盘口拆解：${outcomeLines.join("；")}`,
    `风险标签：${Array.isArray(signalCandidate?.riskTags) && signalCandidate.riskTags.length ? signalCandidate.riskTags.join("、") : "无"}`,
    `附加上下文：${baseline?.confidence ? `confidence=${baseline.confidence}` : "confidence=n/a"}，calibrationMode=${baseline?.calibrationMode || "n/a"}。`,
  ].join("\n");
}

export function buildLocalWatchInterpretation(signalCandidate) {
  return signalCandidate?.watchEdgeBreakdown?.interpretation || signalCandidate?.recommendationText || null;
}

export async function generateWatchInterpretation(signalCandidate, options = {}) {
  const mode = options.mode || process.env.WATCH_INTERPRETATION_MODE || "local";
  const localText = buildLocalWatchInterpretation(signalCandidate);

  if (mode !== "gemini") {
    return {
      mode: "local",
      text: localText,
      model: null,
      grounding: null,
      prompt: null,
      error: null,
    };
  }

  const config = getGeminiConfig();
  if (!config.apiKey) {
    return {
      mode: "local_fallback_no_key",
      text: localText,
      model: null,
      grounding: null,
      prompt: null,
      error: "missing_gemini_key",
    };
  }

  const prompt = buildWatchInterpretationPrompt(signalCandidate);

  try {
    const result = await callGeminiGenerateContent({
      prompt,
      useGoogleSearch: false,
      useUrlContext: false,
      timeoutMs: Number(options.timeoutMs || process.env.WATCH_GEMINI_TIMEOUT_MS || 45000),
      model: options.model || config.model,
      apiKey: options.apiKey || config.apiKey,
      baseUrl: options.baseUrl || config.baseUrl,
      proxyUrl: options.proxyUrl ?? config.proxyUrl,
    });

    const text = result.text || localText;
    return {
      mode: "gemini",
      text,
      model: result.model,
      grounding: result.grounding,
      prompt,
      error: null,
    };
  } catch (error) {
    return {
      mode: "gemini_fallback_error",
      text: localText,
      model: null,
      grounding: null,
      prompt,
      error: error?.message || String(error),
    };
  }
}
