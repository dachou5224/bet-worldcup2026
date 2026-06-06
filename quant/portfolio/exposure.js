function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function round(value, digits = 4) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function rankSignal(signal) {
  const levelRank = {
    SMALL_POSITION: 3,
    CANDIDATE: 2,
    WATCH: 1,
    NO_ACTION: 0,
  };

  return {
    levelRank: levelRank[signal?.recommendationLevel] ?? 0,
    expectedValue: isFiniteNumber(signal?.officialExpectedValue)
      ? signal.officialExpectedValue
      : isFiniteNumber(signal?.expectedValue)
        ? signal.expectedValue
        : -1,
  };
}

function getDayKey(signal, fallbackDate) {
  const candidate = signal?.kickoffLocal || signal?.stopSaleTime || fallbackDate || null;
  if (!candidate) {
    return "unknown";
  }

  const parsed = new Date(candidate);
  if (Number.isNaN(parsed.getTime())) {
    return "unknown";
  }

  return parsed.toISOString().slice(0, 10);
}

function classifyFactors(signal) {
  const factors = new Set();
  const marketType = signal?.marketType || signal?.playType || null;
  const line = signal?.line ?? signal?.handicap ?? null;
  const stage = signal?.stage || signal?.competitionStage || "";
  const outcome = signal?.outcome || signal?.officialSelection || signal?.selection || "";

  if (marketType === "spread" || signal?.playType === "让球胜平负") {
    const numericLine = isFiniteNumber(line) ? line : null;
    if (numericLine != null && numericLine < 0) {
      factors.add("favorite_bias");
    } else if (numericLine != null && numericLine > 0) {
      factors.add("upset_exposure");
    } else {
      factors.add("spread_bias");
    }
  }

  if (marketType === "total") {
    factors.add("low_total_bias");
  }

  if (marketType === "h2h" && (outcome === "draw" || outcome === "平")) {
    factors.add(stage.includes("淘汰") ? "knockout_draw_exposure" : "balanced_draw_bias");
  }

  if (marketType === "h2h" && (outcome === "away" || outcome === "负")) {
    factors.add("upset_exposure");
  }

  if (!factors.size) {
    factors.add("mixed_signal");
  }

  return Array.from(factors);
}

function buildPortfolioCommentary({ acceptedSignals, rejectedSignals, exposureByFactor }) {
  if (!acceptedSignals.length) {
    return "当前候选信号全部被风险门禁或预算约束过滤，未形成可执行组合。";
  }

  const dominantFactor = Object.entries(exposureByFactor).sort((a, b) => b[1] - a[1])[0];
  const factorText = dominantFactor ? `主要暴露在“${dominantFactor[0]}”上` : "因子分布较均衡";

  return `组合层已接受 ${acceptedSignals.length} 个信号，${factorText}。已拒绝 ${rejectedSignals.length} 个候选，避免在同一故事线下重复加仓。`;
}

export function buildPortfolioExposure(candidateSignals, options = {}) {
  const totalRiskBudget = isFiniteNumber(options.totalRiskBudget) ? options.totalRiskBudget : 0.05;
  const singleMatchBudget = isFiniteNumber(options.singleMatchBudget) ? options.singleMatchBudget : 0.02;
  const dayBudget = isFiniteNumber(options.dayBudget) ? options.dayBudget : 0.03;
  const factorBudget = isFiniteNumber(options.factorBudget) ? options.factorBudget : 0.02;
  const generatedAt = options.generatedAt || new Date().toISOString();
  const portfolioId = options.portfolioId || `portfolio-${generatedAt.slice(0, 10)}`;
  const sortedSignals = [...(candidateSignals || [])]
    .filter((signal) => signal && signal.recommendationLevel !== "NO_ACTION")
    .sort((a, b) => {
      const rankA = rankSignal(a);
      const rankB = rankSignal(b);
      if (rankB.levelRank !== rankA.levelRank) {
        return rankB.levelRank - rankA.levelRank;
      }
      return rankB.expectedValue - rankA.expectedValue;
    });

  const acceptedSignals = [];
  const rejectedSignals = [];
  const exposureByFactor = {};
  const exposureByFixture = {};
  const exposureByMarketType = {};
  const exposureByDay = {};
  let usedRiskBudget = 0;

  for (const signal of sortedSignals) {
    const expectedValue = isFiniteNumber(signal.officialExpectedValue)
      ? signal.officialExpectedValue
      : signal.expectedValue;
    const baseFraction = isFiniteNumber(signal.officialFinalStakeFraction)
      ? signal.officialFinalStakeFraction
      : isFiniteNumber(signal.cappedStakeFraction)
        ? signal.cappedStakeFraction
        : isFiniteNumber(signal.fractionalKelly)
          ? signal.fractionalKelly
          : 0;

    if (!isFiniteNumber(expectedValue) || expectedValue <= 0) {
      rejectedSignals.push({
        signal,
        reason: "negative_or_missing_ev",
      });
      continue;
    }

    if (!isFiniteNumber(baseFraction) || baseFraction <= 0) {
      rejectedSignals.push({
        signal,
        reason: "zero_or_missing_stake",
      });
      continue;
    }

    const fixtureKey = String(signal.fixtureId ?? signal.fixture ?? "unknown");
    const dayKey = getDayKey(signal, generatedAt);
    const marketType = signal.marketType || signal.playType || "unknown";
    const factorTags = classifyFactors(signal);

    const fixtureExposure = exposureByFixture[fixtureKey] || 0;
    const dayExposure = exposureByDay[dayKey] || 0;
    const factorExposure = Math.max(...factorTags.map((tag) => exposureByFactor[tag] || 0), 0);
    const remaining = Math.max(
      0,
      Math.min(
        totalRiskBudget - usedRiskBudget,
        singleMatchBudget - fixtureExposure,
        dayBudget - dayExposure,
        factorBudget - factorExposure,
      ),
    );

    if (remaining <= 0) {
      rejectedSignals.push({
        signal,
        reason: "risk_budget_exhausted",
      });
      continue;
    }

    const acceptedFraction = Math.min(baseFraction, remaining);
    if (acceptedFraction <= 0) {
      rejectedSignals.push({
        signal,
        reason: "risk_budget_exhausted",
      });
      continue;
    }

    const accepted = {
      ...signal,
      portfolioStakeFraction: round(acceptedFraction),
      portfolioFactorTags: factorTags,
      portfolioDayKey: dayKey,
      portfolioDecision: "accepted",
    };

    acceptedSignals.push(accepted);
    usedRiskBudget += acceptedFraction;
    exposureByFixture[fixtureKey] = round(fixtureExposure + acceptedFraction);
    exposureByDay[dayKey] = round(dayExposure + acceptedFraction);
    exposureByMarketType[marketType] = round((exposureByMarketType[marketType] || 0) + acceptedFraction);
    for (const factorTag of factorTags) {
      exposureByFactor[factorTag] = round((exposureByFactor[factorTag] || 0) + acceptedFraction);
    }
  }

  return {
    portfolioId,
    generatedAt,
    candidateSignals: acceptedSignals,
    totalRiskBudget,
    exposureByFactor,
    exposureByFixture,
    exposureByMarketType,
    rejectedSignals,
    totalAllocatedRisk: round(usedRiskBudget),
    portfolioCommentary: buildPortfolioCommentary({
      acceptedSignals,
      rejectedSignals,
      exposureByFactor,
    }),
  };
}
