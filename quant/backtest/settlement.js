function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function round(value, digits = 4) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function normalizeScore(finalScore = {}) {
  return {
    home: Number(finalScore.home ?? finalScore.homeScore ?? 0),
    away: Number(finalScore.away ?? finalScore.awayScore ?? 0),
  };
}

function outcomeFromH2H(score) {
  if (score.home > score.away) {
    return "3";
  }
  if (score.home < score.away) {
    return "0";
  }
  return "1";
}

function settleH2HBet({ selectionCode, finalScore, odds, stakeUnits = 1 }) {
  const score = normalizeScore(finalScore);
  const resultCode = outcomeFromH2H(score);
  const won = String(selectionCode) === resultCode;
  const payoutMultiple = won ? Number(odds) || 0 : 0;
  const realizedReturn = round((payoutMultiple - 1) * stakeUnits);

  return {
    marketType: "h2h",
    selectionCode,
    resultCode,
    settlement: won ? "won" : "lost",
    payoutMultiple: won ? payoutMultiple : 0,
    realizedReturn,
  };
}

function settleSpreadBet({ selectionCode, handicap, finalScore, odds, stakeUnits = 1 }) {
  const score = normalizeScore(finalScore);
  const adjusted = score.home + Number(handicap || 0) - score.away;
  const resultCode = adjusted > 0 ? "3" : adjusted < 0 ? "0" : "1";
  const won = String(selectionCode) === resultCode;
  const payoutMultiple = won ? Number(odds) || 0 : 0;
  const realizedReturn = round((payoutMultiple - 1) * stakeUnits);

  return {
    marketType: "spread",
    selectionCode,
    handicap: Number(handicap || 0),
    resultCode,
    settlement: won ? "won" : "lost",
    payoutMultiple: won ? payoutMultiple : 0,
    realizedReturn,
  };
}

function settleTotalBet({ selection, line, finalScore, odds, stakeUnits = 1 }) {
  const score = normalizeScore(finalScore);
  const totalGoals = score.home + score.away;
  const numericLine = Number(line ?? 0);
  const normalizedSelection = String(selection).toLowerCase();
  let actual;

  if (totalGoals > numericLine) {
    actual = "over";
  } else if (totalGoals < numericLine) {
    actual = "under";
  } else {
    actual = "push";
  }

  if (actual === "push") {
    return {
      marketType: "total",
      selection,
      line: numericLine,
      resultCode: "1",
      settlement: "push",
      payoutMultiple: 1,
      realizedReturn: 0,
    };
  }

  const selectionIsOver = ["over", "大", "3+", "1"].includes(normalizedSelection);
  const selectionIsUnder = ["under", "小", "0"].includes(normalizedSelection);
  const won = (selectionIsOver && actual === "over") || (selectionIsUnder && actual === "under");

  const payoutMultiple = won ? Number(odds) || 0 : 0;
  const resultCode = actual === "over" ? "3" : "0";
  const realizedReturn = round((payoutMultiple - 1) * stakeUnits);

  return {
    marketType: "total",
    selection,
    line: numericLine,
    resultCode,
    settlement: won ? "won" : "lost",
    payoutMultiple: won ? payoutMultiple : 0,
    realizedReturn,
  };
}

export function settleMarketBet(bet, options = {}) {
  if (!bet) {
    throw new Error("Bet is required");
  }

  const marketType = bet.marketType || bet.playType || "h2h";
  const stakeUnits = options.stakeUnits ?? bet.stakeUnits ?? 1;
  const odds = options.odds ?? bet.officialOddsAtRecommendation ?? bet.officialOdds ?? 0;

  if (marketType === "h2h" || bet.playType === "胜平负") {
    return settleH2HBet({
      selectionCode: bet.selectionCode ?? bet.selection,
      finalScore: options.finalScore ?? bet.finalScore,
      odds,
      stakeUnits,
    });
  }

  if (marketType === "spread" || bet.playType === "让球胜平负") {
    return settleSpreadBet({
      selectionCode: bet.selectionCode ?? bet.selection,
      handicap: options.handicap ?? bet.handicap ?? 0,
      finalScore: options.finalScore ?? bet.finalScore,
      odds,
      stakeUnits,
    });
  }

  if (marketType === "total") {
    return settleTotalBet({
      selection: bet.selection,
      line: options.line ?? bet.line ?? 0,
      finalScore: options.finalScore ?? bet.finalScore,
      odds,
      stakeUnits,
    });
  }

  throw new Error(`Unsupported marketType for settlement: ${marketType}`);
}

export function computeCalibrationError(probability, actual) {
  if (!isFiniteNumber(probability)) {
    return null;
  }

  return round(Math.abs(probability - actual));
}

export function settleFixtureBet(bet, options = {}) {
  const settlement = settleMarketBet(bet, options);
  return {
    ...settlement,
    stakeUnits: options.stakeUnits ?? bet.stakeUnits ?? 1,
    realizedReturn: settlement.realizedReturn,
  };
}
