function assertScoreMatrix(scoreMatrix) {
  if (!scoreMatrix || !Array.isArray(scoreMatrix.matrix)) {
    throw new Error("scoreMatrix must contain a matrix");
  }
}

function parseScore(score) {
  if (!score || typeof score !== "object") {
    throw new Error("score must be an object");
  }

  const homeGoals = Number(score.homeGoals ?? score.home ?? score.home_score);
  const awayGoals = Number(score.awayGoals ?? score.away ?? score.away_score);

  if (!Number.isInteger(homeGoals) || homeGoals < 0) {
    throw new Error("homeGoals must be a non-negative integer");
  }

  if (!Number.isInteger(awayGoals) || awayGoals < 0) {
    throw new Error("awayGoals must be a non-negative integer");
  }

  return { homeGoals, awayGoals };
}

function buildOutcome(name, probability) {
  return {
    name,
    probability,
    fairOdds: probability > 0 ? 1 / probability : Infinity,
  };
}

export function priceCorrectScore(scoreMatrix, scores = []) {
  assertScoreMatrix(scoreMatrix);

  const normalizedScores = (Array.isArray(scores) ? scores : [scores]).map(parseScore);
  const outcomes = normalizedScores.map(({ homeGoals, awayGoals }) => {
    const probability = scoreMatrix.matrix[homeGoals]?.[awayGoals] ?? 0;
    return buildOutcome(`${homeGoals}-${awayGoals}`, probability);
  });

  return {
    marketType: "correct_score",
    outcomes,
    probabilitySum: outcomes.reduce((sum, outcome) => sum + outcome.probability, 0),
  };
}
