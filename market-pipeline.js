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

export function convertDecimalOddsToProbabilities(odds) {
  const implied = {
    home: 1 / odds.home,
    draw: 1 / odds.draw,
    away: 1 / odds.away,
  };

  const total = implied.home + implied.draw + implied.away;

  return {
    home: implied.home / total,
    draw: implied.draw / total,
    away: implied.away / total,
  };
}

export function averageNormalizedProbabilities(records) {
  return {
    home: average(records.map((record) => record.probabilities.home)),
    draw: average(records.map((record) => record.probabilities.draw)),
    away: average(records.map((record) => record.probabilities.away)),
  };
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

export function buildTomorrowPredictionsFromMarket(rawMarketBoard) {
  return rawMarketBoard.map((match) => {
    const normalizedOdds = match.oddsProviders.map((provider) => ({
      ...provider,
      probabilities: convertDecimalOddsToProbabilities(provider.odds),
    }));

    const oddsAverage = averageNormalizedProbabilities(normalizedOdds);
    const marketAverage = averageNormalizedProbabilities(match.predictionMarkets);

    const modelHome = clamp(oddsAverage.home * 0.7 + marketAverage.home * 0.3 - 0.01, 0.05, 0.9);
    const modelDraw = clamp(oddsAverage.draw * 0.75 + marketAverage.draw * 0.25, 0.05, 0.5);
    const modelAway = clamp(1 - modelHome - modelDraw, 0.05, 0.9);

    const dispersion =
      Math.abs(oddsAverage.home - marketAverage.home) +
      Math.abs(oddsAverage.draw - marketAverage.draw) +
      Math.abs(oddsAverage.away - marketAverage.away);

    const confidence = dispersion > 0.12 ? "low" : dispersion > 0.07 ? "medium" : "high";

    return {
      id: match.id,
      fixture: `${match.home} vs ${match.away}`,
      kickoff: match.kickoff,
      marketHome: round(oddsAverage.home * 100),
      marketDraw: round(oddsAverage.draw * 100),
      marketAway: round(oddsAverage.away * 100),
      modelHome: round(modelHome * 100),
      modelDraw: round(modelDraw * 100),
      modelAway: round(modelAway * 100),
      freshness: match.updatedAtLabel,
      confidence,
      summary:
        confidence === "low"
          ? "盘口和预测市场存在明显分歧，适合在前端高亮展示为“需要复盘”的比赛。"
          : "盘口与预测市场大致同向，这类比赛适合用作 baseline 置信度较高的样本。",
      llm: `LLM 可解释 ${match.home} vs ${match.away} 的概率变化来源，例如盘口漂移、交易市场成交变化和赛前新闻。`,
    };
  });
}
