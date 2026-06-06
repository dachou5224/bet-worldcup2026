function assertScoreMatrix(scoreMatrix) {
  if (!scoreMatrix || !Array.isArray(scoreMatrix.matrix)) {
    throw new Error("scoreMatrix must contain a matrix");
  }
}

function parseHandicap(handicap) {
  const numeric = typeof handicap === "number" ? handicap : Number(handicap);
  if (!Number.isFinite(numeric) || !Number.isInteger(numeric)) {
    throw new Error("handicap must be a finite integer");
  }
  return numeric;
}

function buildOutcome(name, code, probability) {
  return {
    name,
    code,
    probability,
    fairOdds: probability > 0 ? 1 / probability : Infinity,
  };
}

export function priceJingcaiRqspf(scoreMatrix, handicap) {
  assertScoreMatrix(scoreMatrix);
  const parsedHandicap = parseHandicap(handicap);

  let win = 0;
  let draw = 0;
  let lose = 0;

  for (let homeGoals = 0; homeGoals < scoreMatrix.matrix.length; homeGoals += 1) {
    const row = scoreMatrix.matrix[homeGoals];
    for (let awayGoals = 0; awayGoals < row.length; awayGoals += 1) {
      const probability = row[awayGoals];
      const adjustedDiff = homeGoals - awayGoals + parsedHandicap;

      if (adjustedDiff > 0) {
        win += probability;
      } else if (adjustedDiff === 0) {
        draw += probability;
      } else {
        lose += probability;
      }
    }
  }

  return {
    marketType: "jingcai_rqspf",
    handicap: parsedHandicap,
    outcomes: [
      buildOutcome("胜", "3", win),
      buildOutcome("平", "1", draw),
      buildOutcome("负", "0", lose),
    ],
    probabilitySum: win + draw + lose,
  };
}
