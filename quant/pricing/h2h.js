function assertScoreMatrix(scoreMatrix) {
  if (!scoreMatrix || !Array.isArray(scoreMatrix.matrix)) {
    throw new Error("scoreMatrix must contain a matrix");
  }
}

function buildOutcome(name, probability) {
  return {
    name,
    probability,
    fairOdds: probability > 0 ? 1 / probability : Infinity,
  };
}

export function priceH2H(scoreMatrix) {
  assertScoreMatrix(scoreMatrix);

  let home = 0;
  let draw = 0;
  let away = 0;

  for (let homeGoals = 0; homeGoals < scoreMatrix.matrix.length; homeGoals += 1) {
    const row = scoreMatrix.matrix[homeGoals];
    for (let awayGoals = 0; awayGoals < row.length; awayGoals += 1) {
      const probability = row[awayGoals];
      if (homeGoals > awayGoals) {
        home += probability;
      } else if (homeGoals === awayGoals) {
        draw += probability;
      } else {
        away += probability;
      }
    }
  }

  return {
    marketType: "h2h",
    outcomes: [buildOutcome("home", home), buildOutcome("draw", draw), buildOutcome("away", away)],
    probabilitySum: home + draw + away,
  };
}
