function assertScoreMatrix(scoreMatrix) {
  if (!scoreMatrix || !Array.isArray(scoreMatrix.matrix)) {
    throw new Error("scoreMatrix must contain a matrix");
  }
}

function parseLine(line) {
  const numeric = typeof line === "number" ? line : Number(line);
  if (!Number.isFinite(numeric)) {
    throw new Error("line must be a finite number");
  }
  return numeric;
}

function classifyHandicapSettlement(diff, line) {
  const delta = diff + line;
  if (delta > 0) {
    return "win";
  }
  if (delta < 0) {
    return "lose";
  }
  return "push";
}

function splitQuarterLine(line) {
  const scaled = Math.round(line * 4);
  const normalized = scaled / 4;
  const fractional = Math.abs(normalized - Math.trunc(normalized));
  if (Math.abs(fractional - 0.25) > 1e-9 && Math.abs(fractional - 0.75) > 1e-9) {
    return null;
  }

  return [normalized - 0.25, normalized + 0.25];
}

function outcomeFromSettlementResults(results) {
  const [first, second] = results;
  const pair = [first, second].sort().join("+");

  if (pair === "win+win") {
    return "fullWin";
  }
  if (pair === "push+win") {
    return "halfWin";
  }
  if (pair === "lose+win") {
    return "push";
  }
  if (pair === "lose+push") {
    return "halfLoss";
  }
  if (pair === "lose+lose") {
    return "fullLoss";
  }

  throw new Error(`Unsupported settlement pair: ${pair}`);
}

function buildSideSummary(probabilities) {
  const { fullWin = 0, halfWin = 0, push = 0, halfLoss = 0, fullLoss = 0 } = probabilities;
  const expectedReturn =
    fullWin * 2 +
    halfWin * 1.5 +
    push * 1 +
    halfLoss * 0.5 +
    fullLoss * 0;

  const fairOdds =
    fullWin + halfWin * 0.5 > 0
      ? 1 + (fullLoss + halfLoss * 0.5) / (fullWin + halfWin * 0.5)
      : Infinity;

  return {
    ...probabilities,
    expectedReturn,
    fairOdds,
  };
}

function priceSide(scoreMatrix, line, side) {
  const probabilities = {
    fullWin: 0,
    halfWin: 0,
    push: 0,
    halfLoss: 0,
    fullLoss: 0,
  };
  const quarterLines = splitQuarterLine(line);

  for (let homeGoals = 0; homeGoals < scoreMatrix.matrix.length; homeGoals += 1) {
    const row = scoreMatrix.matrix[homeGoals];
    for (let awayGoals = 0; awayGoals < row.length; awayGoals += 1) {
      const probability = row[awayGoals];
      const diff = homeGoals - awayGoals;

      if (quarterLines) {
        const results = quarterLines.map((evaluationLine) => {
          const settlement = classifyHandicapSettlement(
            side === "home" ? diff : -diff,
            side === "home" ? evaluationLine : -evaluationLine,
          );
          return settlement;
        });
        probabilities[outcomeFromSettlementResults(results)] += probability;
        continue;
      }

      const settlement = classifyHandicapSettlement(
        side === "home" ? diff : -diff,
        side === "home" ? line : -line,
      );

      if (settlement === "win") {
        probabilities.fullWin += probability;
      } else if (settlement === "push") {
        probabilities.push += probability;
      } else {
        probabilities.fullLoss += probability;
      }
    }
  }

  return buildSideSummary(probabilities);
}

export function priceSpread(scoreMatrix, line) {
  assertScoreMatrix(scoreMatrix);
  const parsedLine = parseLine(line);

  return {
    marketType: "spread",
    line: parsedLine,
    home: priceSide(scoreMatrix, parsedLine, "home"),
    away: priceSide(scoreMatrix, parsedLine, "away"),
  };
}
