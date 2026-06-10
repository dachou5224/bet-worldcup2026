import { buildMarketSnapshotBundle } from "./quant/normalization/market-snapshot.js";
import { buildMarketBaselineBundle } from "./quant/models/market-baseline.js";
import { buildJingcaiRecommendationsByFixture } from "./quant/output/jingcai-recommendation.js";
import {
  buildSignalCandidatesFromBaseline,
  pickPrimarySignalCandidate,
} from "./quant/recommendation/decision-layer.js";

function round(value, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function average(values) {
  if (!values.length) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function buildFixtureIndex(rawMarketBoard) {
  return new Map(rawMarketBoard.map((match) => [`${match.home} vs ${match.away}`, match]));
}

function formatPercentBucket(probability) {
  if (probability == null || !Number.isFinite(probability)) {
    return null;
  }

  return round(probability * 100);
}

export function buildMarketSourceSummary(rawMarketBoard) {
  const oddsRecords = rawMarketBoard.flatMap((match) => match.oddsProviders);
  const predictionMarketRecords = rawMarketBoard.flatMap((match) => match.predictionMarkets);
  const latestTimestamps = rawMarketBoard.flatMap((match) => [
    ...match.oddsProviders.map((provider) => provider.updatedAt),
    ...match.predictionMarkets.map((provider) => provider.updatedAt),
  ]);

  return [
    {
      name: "Polymarket",
      type: "prediction market",
      typeLabel: "预测市场",
      value: `${predictionMarketRecords.length} 条`,
      detail: "抓 yes/no 市场并折算为胜平负或晋级概率。",
    },
    {
      name: "Bet365 / Pinnacle / 模拟庄家",
      type: "odds",
      typeLabel: "赔率",
      value: `${oddsRecords.length} 条`,
      detail: "当前已统一成三方赔率结构，后续可替换成真实 odds provider 接口。",
    },
    {
      name: "官方比赛数据流",
      type: "live scores",
      typeLabel: "实时比分",
      value: "已预留接入",
      detail: "接口已留好，后续只需要补实时赛程/比分数据提供器。",
    },
    {
      name: "数据新鲜度窗口",
      type: "data quality",
      typeLabel: "数据质量",
      value: latestTimestamps.sort().slice(-1)[0] || "n/a",
      detail: "每条市场记录都带更新时间，方便做赛前漂移和过期检测。",
    },
  ];
}

export function buildSignalCandidatesFromMarket(rawMarketBoard, options = {}) {
  const snapshotBundle = buildMarketSnapshotBundle(rawMarketBoard);
  const baselineBundle = buildMarketBaselineBundle(snapshotBundle.marketSnapshots);

  return baselineBundle.baselines.flatMap((baseline) =>
    buildSignalCandidatesFromBaseline(baseline, options),
  );
}

export function buildSignalCandidateGroupsFromMarket(rawMarketBoard, options = {}) {
  const snapshotBundle = buildMarketSnapshotBundle(rawMarketBoard);
  const baselineBundle = buildMarketBaselineBundle(snapshotBundle.marketSnapshots);
  const grouped = new Map();

  for (const baseline of baselineBundle.baselines) {
    const current = grouped.get(baseline.fixtureId) || {
      fixtureId: baseline.fixtureId,
      fixture: baseline.fixture,
      signalCandidates: [],
      marketBaselines: [],
    };

    const candidates = buildSignalCandidatesFromBaseline(baseline, options);
    current.signalCandidates.push(...candidates);
    current.marketBaselines.push(baseline);
    grouped.set(baseline.fixtureId, current);
  }

  return Array.from(grouped.values());
}

export function buildJingcaiRecommendationsFromMarket(rawMarketBoard, officialFeed, options = {}) {
  const groups = buildSignalCandidateGroupsFromMarket(rawMarketBoard, options);
  return buildJingcaiRecommendationsByFixture(groups, officialFeed, options);
}

function buildPredictionSummaryFromBaseline(baseline, rawMatch, options = {}) {
  const candidates = buildSignalCandidatesFromBaseline(baseline, options);
  const primarySignalCandidate = pickPrimarySignalCandidate(candidates);
  const marketHome = baseline.bookmakerConsensus.home ?? baseline.predictionConsensus.home ?? null;
  const marketDraw = baseline.bookmakerConsensus.draw ?? baseline.predictionConsensus.draw ?? null;
  const marketAway = baseline.bookmakerConsensus.away ?? baseline.predictionConsensus.away ?? null;
  const hasCalibratedModel = baseline.dataOk && baseline.calibrationMode !== "skipped_no_bookmaker";
  const modelHome = hasCalibratedModel
    ? formatPercentBucket(baseline.modelConsensus.home ?? marketHome)
    : null;
  const modelDraw = hasCalibratedModel
    ? formatPercentBucket(baseline.modelConsensus.draw ?? marketDraw)
    : null;
  const modelAway = hasCalibratedModel
    ? formatPercentBucket(baseline.modelConsensus.away ?? marketAway)
    : null;
  const fixtureLabel = baseline.fixture || `${rawMatch.home} vs ${rawMatch.away}`;
  const riskNotes = baseline.riskTags.length ? baseline.riskTags.join("、") : "市场和模型共识总体稳定";
  const pmOnly = baseline.riskTags.includes("bookmaker_missing");

  let summary;
  if (pmOnly) {
    summary = `仅有预测市场数据，缺少 bookmaker 赔率，无法完成模型校准。${riskNotes ? ` 风险标签：${riskNotes}` : ""}`;
  } else if (baseline.confidence === "low") {
    summary = `盘口和预测市场存在明显分歧，适合在前端高亮展示为“需要复盘”的比赛。${riskNotes ? ` 风险标签：${riskNotes}` : ""}`;
  } else {
    summary = `盘口与预测市场大致同向，这类比赛适合用作 baseline 置信度较高的样本。${riskNotes ? ` 风险标签：${riskNotes}` : ""}`;
  }

  return {
    id: rawMatch.id,
    fixture: fixtureLabel,
    kickoff: rawMatch.kickoff,
    marketHome: formatPercentBucket(marketHome),
    marketDraw: formatPercentBucket(marketDraw),
    marketAway: formatPercentBucket(marketAway),
    modelHome,
    modelDraw,
    modelAway,
    freshness: rawMatch.updatedAtLabel,
    confidence: baseline.confidence,
    summary,
    llm: pmOnly
      ? null
      : `LLM 可解释 ${rawMatch.home} vs ${rawMatch.away} 的概率变化来源，例如盘口漂移、交易市场成交变化和赛前新闻。`,
    signalCandidates: candidates,
    signalCandidate: primarySignalCandidate,
    marketBaseline: baseline,
  };
}

export function buildTomorrowPredictionsFromMarket(rawMarketBoard, options = {}) {
  const snapshotBundle = buildMarketSnapshotBundle(rawMarketBoard);
  const baselineBundle = buildMarketBaselineBundle(snapshotBundle.marketSnapshots);
  const fixtureIndex = buildFixtureIndex(rawMarketBoard);
  const h2hBaselines = baselineBundle.baselines.filter((baseline) => baseline.marketType === "h2h");

  return h2hBaselines.map((baseline) => {
    const rawMatch = fixtureIndex.get(baseline.fixture) || {
      id: baseline.fixtureId,
      home: baseline.fixture?.split(" vs ")?.[0] || baseline.fixtureId,
      away: baseline.fixture?.split(" vs ")?.[1] || baseline.fixtureId,
      kickoff: "",
      updatedAtLabel: "实时",
    };

    return buildPredictionSummaryFromBaseline(baseline, rawMatch, options);
  });
}
