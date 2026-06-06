export function computeDisagreement(item) {
  return (
    Math.abs(item.marketHome - item.modelHome) +
    Math.abs(item.marketDraw - item.modelDraw) +
    Math.abs(item.marketAway - item.modelAway)
  );
}

export function getConfidenceTone(value) {
  return value === "high" ? "good" : value === "medium" ? "neutral" : "warn";
}

export function computeConfidenceScore(item) {
  const edge = computeDisagreement(item);
  const base = item.confidence === "high" ? 82 : item.confidence === "medium" ? 64 : 42;
  return Math.min(100, Math.round(base + edge * 2.5));
}

export function summarizeLean(item, prefix) {
  const values = [
    { key: "主", value: item[`${prefix}Home`] },
    { key: "平", value: item[`${prefix}Draw`] },
    { key: "客", value: item[`${prefix}Away`] },
  ].sort((a, b) => b.value - a.value);

  return { label: values[0].key, value: values[0].value };
}

export function getTopEdgeOutcome(item) {
  const outcomes = [
    { key: "home", label: "主胜", market: item.marketHome, model: item.modelHome },
    { key: "draw", label: "平局", market: item.marketDraw, model: item.modelDraw },
    { key: "away", label: "客胜", market: item.marketAway, model: item.modelAway },
  ];

  return outcomes.sort((a, b) => Math.abs(b.model - b.market) - Math.abs(a.model - a.market))[0];
}

export function computeFairOdd(probability) {
  if (!probability || probability <= 0) {
    return "—";
  }
  return (100 / probability).toFixed(2);
}

export function getSignalTier(item) {
  const score = computeConfidenceScore(item);
  if (score >= 75) {
    return { label: "强信号", tone: "strong" };
  }
  if (score >= 55) {
    return { label: "中性", tone: "neutral" };
  }
  return { label: "观察", tone: "watch" };
}
