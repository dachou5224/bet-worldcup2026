function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function round(value, digits = 4) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function computeBrier(probabilities, actualOutcome) {
  if (!probabilities || typeof probabilities !== "object") {
    return null;
  }

  const keys = Object.keys(probabilities);
  if (!keys.length) {
    return null;
  }

  const total = keys.reduce((sum, key) => {
    const predicted = isFiniteNumber(probabilities[key]) ? probabilities[key] : 0;
    const actual = key === actualOutcome ? 1 : 0;
    return sum + (predicted - actual) ** 2;
  }, 0);

  return round(total);
}

export function computeLogLoss(probabilities, actualOutcome) {
  if (!probabilities || typeof probabilities !== "object") {
    return null;
  }

  const actual = probabilities[actualOutcome];
  if (!isFiniteNumber(actual) || actual <= 0) {
    return Infinity;
  }

  return round(-Math.log(actual));
}

export function computeClosingLineValue(takenOdds, closingOdds) {
  if (!isFiniteNumber(takenOdds) || !isFiniteNumber(closingOdds)) {
    return null;
  }

  return round(takenOdds - closingOdds);
}

export function summarizeBacktestRecords(records) {
  const reviewed = (records || []).filter(Boolean);
  if (!reviewed.length) {
    return {
      recordCount: 0,
      meanBrier: null,
      meanLogLoss: null,
      meanClv: null,
      officialReturn: 0,
      jingcaiSettlement: null,
    };
  }

  const briers = reviewed.map((record) => computeBrier(record.modelBeforeKickoff, record.actualOutcome)).filter(isFiniteNumber);
  const logLosses = reviewed.map((record) => computeLogLoss(record.modelBeforeKickoff, record.actualOutcome)).filter(isFiniteNumber);
  const clvs = reviewed.map((record) => computeClosingLineValue(record.officialOddsAtRecommendation, record.officialOddsAtStopSale)).filter(isFiniteNumber);
  const officialReturn = reviewed.reduce((sum, record) => sum + (isFiniteNumber(record.jingcaiSettlement?.realizedReturnOfficial) ? record.jingcaiSettlement.realizedReturnOfficial : 0), 0);
  const jingcaiSettlement = reviewed.map((record) => record.jingcaiSettlement || null);

  return {
    recordCount: reviewed.length,
    meanBrier: briers.length ? round(briers.reduce((sum, value) => sum + value, 0) / briers.length) : null,
    meanLogLoss: logLosses.length ? round(logLosses.reduce((sum, value) => sum + value, 0) / logLosses.length) : null,
    meanClv: clvs.length ? round(clvs.reduce((sum, value) => sum + value, 0) / clvs.length) : null,
    officialReturn: round(officialReturn),
    jingcaiSettlement,
  };
}

export function buildPortfolioReviewSummary(portfolio) {
  if (!portfolio) {
    return {
      portfolioId: null,
      generatedAt: new Date().toISOString(),
      candidateCount: 0,
      totalRiskBudget: 0,
      totalAllocatedRisk: 0,
      exposureByFactor: {},
      exposureByFixture: {},
      exposureByMarketType: {},
      portfolioCommentary: "暂无组合信号。",
    };
  }

  return {
    portfolioId: portfolio.portfolioId || null,
    generatedAt: portfolio.generatedAt || new Date().toISOString(),
    candidateCount: (portfolio.candidateSignals || []).length,
    totalRiskBudget: portfolio.totalRiskBudget || 0,
    totalAllocatedRisk: portfolio.totalAllocatedRisk || 0,
    exposureByFactor: portfolio.exposureByFactor || {},
    exposureByFixture: portfolio.exposureByFixture || {},
    exposureByMarketType: portfolio.exposureByMarketType || {},
    rejectedCount: (portfolio.rejectedSignals || []).length,
    portfolioCommentary: portfolio.portfolioCommentary || "",
  };
}
