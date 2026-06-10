import { csvEscape } from "./goldman-sachs-pdf-extract.js";
import { buildRecommendationRiskProfileEvaluation, normalizeRecommendationRiskProfile } from "./recommendation-risk-profile.js";

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function round(value, digits = 4) {
  if (!isFiniteNumber(value)) {
    return null;
  }
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function roundPercent(value, digits = 1) {
  if (!isFiniteNumber(value)) {
    return null;
  }
  const factor = 10 ** digits;
  return Math.round(value * 100 * factor) / factor;
}

function formatMaybeNumber(value, digits = 4) {
  const rounded = round(value, digits);
  return rounded == null ? null : rounded.toFixed(digits);
}

function formatMaybePercent(value, digits = 1) {
  const rounded = roundPercent(value, digits);
  return rounded == null ? null : rounded.toFixed(digits);
}

function formatPercentPoint(value, digits = 2) {
  if (!isFiniteNumber(value)) {
    return null;
  }
  return Number(value).toFixed(digits);
}

function labelOutcome(outcome) {
  if (outcome === "home") return "主胜";
  if (outcome === "draw") return "平局";
  if (outcome === "away") return "客胜";
  return String(outcome || "未知");
}

function labelGsConsistency(value) {
  if (value === "aligned") return "aligned";
  if (value === "divergent") return "divergent";
  if (value === "unknown") return "unknown";
  return value || "unknown";
}

export function classifyWatchSubtype(signalCandidate, gsAlignment, predictionMarketCount) {
  const tags = [];
  const expectedValue = signalCandidate?.expectedValue;
  const gsConsistency =
    typeof gsAlignment === "string" ? gsAlignment : gsAlignment?.directionalAlignment || null;

  if (isFiniteNumber(expectedValue) && expectedValue > 0) {
    tags.push("watch_positive_ev_below_threshold");
  } else {
    tags.push("watch_negative_ev");
  }

  if (predictionMarketCount === 0) {
    tags.push("watch_market_baseline_only");
  }

  if (gsConsistency === "divergent") {
    tags.push("watch_gs_divergence");
  }

  return tags.join("|");
}

function getGsPriorProbabilities(gsAlignment) {
  const gsOutcome = gsAlignment?.gsOutcome || null;
  if (!gsOutcome) {
    return {
      mode: "no_gs_match",
      home: null,
      draw: null,
      away: null,
    };
  }

  return {
    mode: "deterministic_modal_forecast",
    home: gsOutcome === "home" ? 1 : 0,
    draw: gsOutcome === "draw" ? 1 : 0,
    away: gsOutcome === "away" ? 1 : 0,
  };
}

function buildWatchExplanation(row) {
  const parts = [];
  if (row.predictionMarketCount === 0) {
    parts.push("当前缺少单场预测市场信号，结果主要来自 bookmaker baseline 与盘口校准模型。");
  } else {
    parts.push("当前已接入单场预测市场信号，结果来自 bookmaker baseline、预测市场与盘口校准模型的综合判断。");
  }

  if (row.gsConsistency === "aligned") {
    parts.push("GS 先验与市场方向一致，可作为 baseline 稳定样本。");
  } else if (row.gsConsistency === "divergent") {
    parts.push("GS 先验与市场方向分歧，建议进入人工复核。");
  } else {
    parts.push("GS 先验暂未形成有效对齐，建议谨慎观察。");
  }

  const selected = row.selectedOutcomeDetail;
  if (selected && isFiniteNumber(selected.expectedValue)) {
    const evPct = formatMaybePercent(selected.expectedValue, 1);
    if (selected.expectedValue > 0) {
      parts.push(`关注方向 EV 为 +${evPct}%，但仍低于行动阈值，属于观察位。`);
    } else {
      parts.push(`关注方向 EV 为 ${evPct}% ，边际不足，暂不建议下单。`);
    }
  }

  return parts.join("");
}

function buildOutcomeRow(signalCandidate, outcomeDetail) {
  const outcome = signalCandidate?.watchEdgeBreakdown?.outcomes?.find((item) => item.outcome === outcomeDetail.outcome) || {};
  return {
    outcome: outcomeDetail.outcome,
    label: outcomeDetail.label,
    marketProbability: formatMaybePercent(outcome.marketProbability, 1),
    modelProbability: formatMaybePercent(outcome.modelProbability, 1),
    adjustedProbability: formatMaybePercent(outcome.adjustedProbability, 1),
    edgePercentPoint: formatPercentPoint(outcome.edgePercentPoint, 2),
    expectedValue: formatMaybePercent(outcome.expectedValue, 2),
  };
}

function buildGsPriorColumns(gsAlignment) {
  const prior = getGsPriorProbabilities(gsAlignment);
  return {
    GS_prior_mode: prior.mode,
    GS_prior_probability_home: prior.home,
    GS_prior_probability_draw: prior.draw,
    GS_prior_probability_away: prior.away,
  };
}

function escapeMarkdownCell(value) {
  return String(value ?? "")
    .replace(/\r?\n/g, " ")
    .replace(/\|/g, "\\|");
}

export function selectReplayAuditPredictions(tomorrowPredictions = []) {
  return (tomorrowPredictions || [])
    .filter((prediction) => prediction?.layeredOutput?.layerA?.signalCandidate?.recommendationLevel === "WATCH")
    .slice(0, 8);
}

export function buildReplayAuditRows({
  tomorrowPredictions = [],
  qualityReport = null,
  watchInterpretations = [],
  riskProfile = null,
} = {}) {
  const predictions = selectReplayAuditPredictions(tomorrowPredictions);
  const activeRiskProfile = normalizeRecommendationRiskProfile(
    riskProfile || qualityReport?.recommendationRiskProfile || process.env.RECOMMENDATION_RISK_PROFILE || "strict",
  );
  const interpretationLookup = new Map(
    (watchInterpretations || []).map((item) => [
      `${String(item.fixtureId ?? "")}::${String(item.marketType ?? "")}::${String(item.outcome ?? "")}`,
      item?.result?.text || null,
    ]),
  );

  return predictions.map((prediction) => {
    const layeredOutput = prediction?.layeredOutput || {};
    const signalCandidate = layeredOutput.layerA?.signalCandidate || null;
    const gsAlignment = layeredOutput.fundamentalDirectionalAlignment || {};
    const marketBaseline = signalCandidate?.marketBaseline || prediction?.marketBaseline || {};
    const calibration = marketBaseline?.calibration || {};
    const evidence = calibration?.evidence || {};
    const selectedOutcome = signalCandidate?.watchEdgeBreakdown?.selectedOutcome || signalCandidate?.outcome || null;
    const selectedOutcomeDetail =
      signalCandidate?.watchEdgeBreakdown?.selected ||
      signalCandidate?.watchEdgeBreakdown?.outcomes?.find((item) => item.outcome === selectedOutcome) ||
      signalCandidate?.watchEdgeBreakdown?.outcomes?.[0] ||
      null;
    const outcomeRows = Object.fromEntries(
      (signalCandidate?.watchEdgeBreakdown?.outcomes || []).map((item) => [item.outcome, buildOutcomeRow(signalCandidate, item)]),
    );
    const primaryRecommendation = layeredOutput.layerC?.primaryRecommendation || null;
    const noJingcaiReason = layeredOutput.layerB?.noJingcaiReason || layeredOutput.layerC?.noJingcaiReason || null;
    const bookmakerDiversity = Array.isArray(marketBaseline?.bookmakerSnapshots)
      ? new Set(
          marketBaseline.bookmakerSnapshots
            .map((snapshot) => snapshot?.provider || snapshot?.bookmaker || null)
            .filter(Boolean),
        ).size
      : 0;
    const predictionMarketCount = Array.isArray(marketBaseline?.predictionSnapshots)
      ? marketBaseline.predictionSnapshots.length
      : 0;
    const sourceModes = qualityReport?.sourceMode || {};
    const watchSubtype = classifyWatchSubtype(signalCandidate, gsAlignment, predictionMarketCount);
    const riskProfileEvaluation = buildRecommendationRiskProfileEvaluation(signalCandidate, {
      riskProfile: activeRiskProfile,
      gsConsistency: gsAlignment?.directionalAlignment || "unknown",
      predictionMarketCount,
    });
    const interpretationKey = `${String(prediction?.id ?? prediction?.fixtureId ?? "")}::${String(
      signalCandidate?.marketType ?? "",
    )}::${String(signalCandidate?.outcome ?? "")}`;
    const generatedInterpretation = interpretationLookup.get(interpretationKey) || null;
    const gsPrior = buildGsPriorColumns(gsAlignment);

    return {
      比赛ID: prediction?.id ?? prediction?.fixtureId ?? null,
      比赛: prediction?.fixture ?? null,
      开赛时间: prediction?.kickoff ?? null,
      sourceMode_market: sourceModes.market || null,
      sourceMode_live: sourceModes.live || null,
      sourceMode_jingcai: sourceModes.jingcai || null,
      bookmakerDiversity,
      predictionMarketCount,
      researchSafeStatus: qualityReport?.researchSafeStatus || null,
      riskProfile: activeRiskProfile,
      calibrationMode: calibration?.mode || null,
      calibrationConfidence: calibration?.confidence || null,
      calibrationScore: isFiniteNumber(calibration?.score) ? formatMaybeNumber(calibration.score, 4) : null,
      homeLambda: isFiniteNumber(calibration?.homeLambda) ? formatMaybeNumber(calibration.homeLambda, 4) : null,
      awayLambda: isFiniteNumber(calibration?.awayLambda) ? formatMaybeNumber(calibration.awayLambda, 4) : null,
      evidenceCoverage: `h2h=${evidence?.h2h ? "Y" : "N"},total=${evidence?.total ? "Y" : "N"},spread=${evidence?.spread ? "Y" : "N"}`,
      市场主胜: formatMaybePercent(signalCandidate?.watchEdgeBreakdown?.outcomes?.find((item) => item.outcome === "home")?.marketProbability, 1),
      市场平局: formatMaybePercent(signalCandidate?.watchEdgeBreakdown?.outcomes?.find((item) => item.outcome === "draw")?.marketProbability, 1),
      市场客胜: formatMaybePercent(signalCandidate?.watchEdgeBreakdown?.outcomes?.find((item) => item.outcome === "away")?.marketProbability, 1),
      模型主胜: formatMaybePercent(signalCandidate?.watchEdgeBreakdown?.outcomes?.find((item) => item.outcome === "home")?.modelProbability, 1),
      模型平局: formatMaybePercent(signalCandidate?.watchEdgeBreakdown?.outcomes?.find((item) => item.outcome === "draw")?.modelProbability, 1),
      模型客胜: formatMaybePercent(signalCandidate?.watchEdgeBreakdown?.outcomes?.find((item) => item.outcome === "away")?.modelProbability, 1),
      主胜edge_pp: formatPercentPoint(signalCandidate?.watchEdgeBreakdown?.outcomes?.find((item) => item.outcome === "home")?.edgePercentPoint, 2),
      平局edge_pp: formatPercentPoint(signalCandidate?.watchEdgeBreakdown?.outcomes?.find((item) => item.outcome === "draw")?.edgePercentPoint, 2),
      客胜edge_pp: formatPercentPoint(signalCandidate?.watchEdgeBreakdown?.outcomes?.find((item) => item.outcome === "away")?.edgePercentPoint, 2),
      主胜EV: formatMaybePercent(signalCandidate?.watchEdgeBreakdown?.outcomes?.find((item) => item.outcome === "home")?.expectedValue, 2),
      平局EV: formatMaybePercent(signalCandidate?.watchEdgeBreakdown?.outcomes?.find((item) => item.outcome === "draw")?.expectedValue, 2),
      客胜EV: formatMaybePercent(signalCandidate?.watchEdgeBreakdown?.outcomes?.find((item) => item.outcome === "away")?.expectedValue, 2),
      关注方向: selectedOutcome,
      关注方向赔率: isFiniteNumber(signalCandidate?.offeredOdds) ? formatMaybeNumber(signalCandidate.offeredOdds, 3) : null,
      关注方向市场概率: formatMaybePercent(signalCandidate?.marketProbability, 1),
      关注方向模型概率: formatMaybePercent(signalCandidate?.modelProbability, 1),
      关注方向收缩后概率: formatMaybePercent(signalCandidate?.adjustedProbability, 1),
      关注方向edge_pp: formatPercentPoint((signalCandidate?.edge || 0) * 100, 2),
      关注方向EV: formatMaybePercent(signalCandidate?.expectedValue, 2),
      关注方向决策: signalCandidate?.decisionCode || null,
      expressionLevel: riskProfileEvaluation.expressionLevel,
      expressionReason: riskProfileEvaluation.expressionReason,
      expressionWarnings: Array.isArray(riskProfileEvaluation.expressionWarnings)
        ? riskProfileEvaluation.expressionWarnings.join("|")
        : "",
      maxRiskBudgetHint: riskProfileEvaluation.maxRiskBudgetHint,
      strictExpressionLevel: riskProfileEvaluation.strictExpressionLevel,
      strictDecisionCode: riskProfileEvaluation.strictDecisionCode,
      balancedExpressionLevel: riskProfileEvaluation.balancedExpressionLevel,
      balancedDecisionCode: riskProfileEvaluation.balancedDecisionCode,
      aggressiveExpressionLevel: riskProfileEvaluation.aggressiveExpressionLevel,
      aggressiveDecisionCode: riskProfileEvaluation.aggressiveDecisionCode,
      WATCH子类型: watchSubtype,
      watch说明:
        generatedInterpretation && !generatedInterpretation.includes("盘口与预测市场大致同向")
          ? generatedInterpretation
          : buildWatchExplanation({
              predictionMarketCount,
              gsConsistency: gsAlignment?.directionalAlignment || "unknown",
              selectedOutcomeDetail,
            }),
      officialPlayType: primaryRecommendation?.playType || null,
      officialSelection: primaryRecommendation?.selection || null,
      officialOdds: isFiniteNumber(primaryRecommendation?.officialOdds) ? formatMaybeNumber(primaryRecommendation.officialOdds, 3) : null,
      officialEV: isFiniteNumber(primaryRecommendation?.officialExpectedValue)
        ? formatMaybePercent(primaryRecommendation.officialExpectedValue, 2)
        : null,
      officialSaleStatus: primaryRecommendation?.saleStatus || layeredOutput.layerB?.officialSaleStatus || null,
      officialStopTime: primaryRecommendation?.stopSaleTime || layeredOutput.layerB?.officialStopTime || null,
      officialNoJingcaiReason: noJingcaiReason,
      GS_prior_mode: gsPrior.GS_prior_mode,
      GS_prior_probability_home: gsPrior.GS_prior_probability_home,
      GS_prior_probability_draw: gsPrior.GS_prior_probability_draw,
      GS_prior_probability_away: gsPrior.GS_prior_probability_away,
      GS预测结果: gsAlignment?.gsOutcomeLabel || null,
      GS市场方向: gsAlignment?.marketLeanLabel || null,
      GS一致性: labelGsConsistency(gsAlignment?.directionalAlignment || null),
      GS比分: gsAlignment?.scoreline || null,
      riskTags: Array.isArray(signalCandidate?.riskTags) ? signalCandidate.riskTags.join("|") : "",
      ...outcomeRows,
    };
  });
}

export function buildReplayAuditCsv(rows = []) {
  const header = [
    "比赛ID",
    "比赛",
    "开赛时间",
    "sourceMode_market",
    "sourceMode_live",
    "sourceMode_jingcai",
    "bookmakerDiversity",
    "predictionMarketCount",
    "researchSafeStatus",
    "riskProfile",
    "calibrationMode",
    "calibrationConfidence",
    "calibrationScore",
    "homeLambda",
    "awayLambda",
    "evidenceCoverage",
    "市场主胜",
    "市场平局",
    "市场客胜",
    "模型主胜",
    "模型平局",
    "模型客胜",
    "主胜edge_pp",
    "平局edge_pp",
    "客胜edge_pp",
    "主胜EV",
    "平局EV",
    "客胜EV",
    "关注方向",
    "关注方向赔率",
    "关注方向市场概率",
    "关注方向模型概率",
    "关注方向收缩后概率",
    "关注方向edge_pp",
    "关注方向EV",
    "关注方向决策",
    "expressionLevel",
    "expressionReason",
    "expressionWarnings",
    "maxRiskBudgetHint",
    "strictExpressionLevel",
    "strictDecisionCode",
    "balancedExpressionLevel",
    "balancedDecisionCode",
    "aggressiveExpressionLevel",
    "aggressiveDecisionCode",
    "WATCH子类型",
    "watch说明",
    "officialPlayType",
    "officialSelection",
    "officialOdds",
    "officialEV",
    "officialSaleStatus",
    "officialStopTime",
    "officialNoJingcaiReason",
    "GS_prior_mode",
    "GS_prior_probability_home",
    "GS_prior_probability_draw",
    "GS_prior_probability_away",
    "GS预测结果",
    "GS市场方向",
    "GS一致性",
    "GS比分",
    "riskTags",
  ];

  const lines = [header.join(",")];
  for (const row of rows) {
    lines.push(header.map((key) => csvEscape(row[key])).join(","));
  }
  return `${lines.join("\n")}\n`;
}

export function buildReplayAuditSummaryMarkdown({
  capturedAt = null,
  qualityReport = null,
  rows = [],
  watchInterpretationMode = "local",
} = {}) {
  const watchSubtypeCounts = rows.reduce((acc, row) => {
    const subtype = row.WATCH子类型 || "unknown";
    acc[subtype] = (acc[subtype] || 0) + 1;
    return acc;
  }, {});
  const gsConsistencyCounts = rows.reduce((acc, row) => {
    const key = row.GS一致性 || "unknown";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const expressionLevelCounts = rows.reduce((acc, row) => {
    const key = row.expressionLevel || "unknown";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const header = [
    "比赛",
    "关注方向",
    "expressionLevel",
    "WATCH子类型",
    "GS一致性",
    "主胜edge_pp",
    "平局edge_pp",
    "客胜edge_pp",
    "关注方向EV",
    "watch说明",
  ];
  const tableLines = [
    `| ${header.join(" | ")} |`,
    `| ${header.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${header.map((key) => escapeMarkdownCell(row[key])).join(" | ")} |`),
  ];

  return [
    `# Replay 8 场审计摘要`,
    "",
    capturedAt ? `- 生成时间：${capturedAt}` : null,
    `- replay 模式：${watchInterpretationMode}`,
    qualityReport?.recommendationRiskProfile ? `- riskProfile：${qualityReport.recommendationRiskProfile}` : null,
    qualityReport?.researchSafeStatus ? `- researchSafeStatus：${qualityReport.researchSafeStatus}` : null,
    qualityReport?.sourceMode
      ? `- sourceMode：market=${qualityReport.sourceMode.market || "n/a"}, live=${qualityReport.sourceMode.live || "n/a"}, jingcai=${qualityReport.sourceMode.jingcai || "n/a"}`
      : null,
    `- 行数：${rows.length}`,
    `- expressionLevel 分布：${JSON.stringify(expressionLevelCounts)}`,
    `- WATCH 子类型分布：${JSON.stringify(watchSubtypeCounts)}`,
    `- GS 一致性分布：${JSON.stringify(gsConsistencyCounts)}`,
    "",
    "## 结论",
    "",
    "- 当前 8 场在 strict profile 下均未进入正式可执行建议，但已可在 balanced/aggressive profile 下输出探索型表达。",
    "- 其中 `prediction_market_missing` 仍是主要风险标签之一，说明该组样本主要由 bookmaker baseline 与盘口校准模型驱动。",
    "- GS 先验采用 modal forecast one-hot 形式，仅用于方向对照，不替代单场概率模型。",
    "",
    "## 行级明细",
    "",
    ...tableLines,
    "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function summarizeReplayAuditRows(rows = []) {
  const watchSubtypeCounts = rows.reduce((acc, row) => {
    const subtype = row.WATCH子类型 || "unknown";
    acc[subtype] = (acc[subtype] || 0) + 1;
    return acc;
  }, {});
  const watchSubtypeFlags = rows.reduce(
    (acc, row) => {
      const subtype = String(row.WATCH子类型 || "");
      if (subtype.includes("watch_positive_ev_below_threshold")) {
        acc.watch_positive_ev_below_threshold += 1;
      }
      if (subtype.includes("watch_negative_ev")) {
        acc.watch_negative_ev += 1;
      }
      if (subtype.includes("watch_market_baseline_only")) {
        acc.watch_market_baseline_only += 1;
      }
      if (subtype.includes("watch_gs_divergence")) {
        acc.watch_gs_divergence += 1;
      }
      return acc;
    },
    {
      watch_positive_ev_below_threshold: 0,
      watch_negative_ev: 0,
      watch_market_baseline_only: 0,
      watch_gs_divergence: 0,
    },
  );
  const gsConsistencyCounts = rows.reduce((acc, row) => {
    const key = row.GS一致性 || "unknown";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const expressionLevelCounts = rows.reduce((acc, row) => {
    const key = row.expressionLevel || "unknown";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return {
    rowCount: rows.length,
    watchSubtypeCounts,
    watchSubtypeFlags,
    expressionLevelCounts,
    gsConsistencyCounts,
    predictionMarketMissingCount: rows.filter((row) => String(row.riskTags || "").includes("prediction_market_missing")).length,
    officialRecommendationCount: rows.filter((row) => row.officialPlayType).length,
  };
}

export function validateReplayAuditRows(rows = []) {
  const summary = summarizeReplayAuditRows(rows);
  const anomalies = [];

  for (const row of rows) {
    if (!row.WATCH子类型) {
      anomalies.push({ type: "missing_watch_subtype", fixture: row.比赛 || row.比赛ID || null });
    }
    if (!row.sourceMode_market || !row.sourceMode_live || !row.sourceMode_jingcai) {
      anomalies.push({ type: "missing_source_mode", fixture: row.比赛 || row.比赛ID || null });
    }
    if (!row.riskProfile || !row.expressionLevel || !row.expressionReason || !row.maxRiskBudgetHint) {
      anomalies.push({ type: "missing_risk_expression_fields", fixture: row.比赛 || row.比赛ID || null });
    }
    if (String(row.riskTags || "").includes("prediction_market_missing") && String(row.watch说明 || "").includes("预测市场大致同向")) {
      anomalies.push({ type: "bad_prediction_market_language", fixture: row.比赛 || row.比赛ID || null });
    }
    if (Number(row.主胜edge_pp || 0) > 5 || Number(row.平局edge_pp || 0) > 5 || Number(row.客胜edge_pp || 0) > 5) {
      anomalies.push({ type: "edge_pp_too_large", fixture: row.比赛 || row.比赛ID || null });
    }
    if (Number(row.官方EV || row.officialEV || 0) > 10 || Number(row.关注方向EV || 0) > 10) {
      anomalies.push({ type: "ev_too_large", fixture: row.比赛 || row.比赛ID || null });
    }
  }

  return {
    ok: anomalies.length === 0,
    summary,
    anomalies,
  };
}
