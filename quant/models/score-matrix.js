import { normalizeDistribution, poissonDistribution } from "./poisson.js";

function assertLambda(lambda, label) {
  if (!Number.isFinite(lambda) || lambda < 0) {
    throw new Error(`${label} must be a finite number greater than or equal to 0`);
  }
}

function matrixTotal(matrix) {
  return matrix.reduce(
    (outerSum, row) => outerSum + row.reduce((innerSum, cell) => innerSum + cell, 0),
    0,
  );
}

export function buildScoreMatrix({ homeLambda, awayLambda, maxGoals = 10 } = {}) {
  assertLambda(homeLambda, "homeLambda");
  assertLambda(awayLambda, "awayLambda");

  if (!Number.isInteger(maxGoals) || maxGoals < 0) {
    throw new Error("maxGoals must be a non-negative integer");
  }

  const homeDistribution = normalizeDistribution(poissonDistribution(homeLambda, maxGoals));
  const awayDistribution = normalizeDistribution(poissonDistribution(awayLambda, maxGoals));

  const matrix = homeDistribution.normalized.map((homeOutcome) =>
    awayDistribution.normalized.map((awayOutcome) => homeOutcome.probability * awayOutcome.probability),
  );

  const rawMass = matrixTotal(matrix);
  const normalizedMatrix = matrix.map((row) => row.map((value) => value / rawMass));

  return {
    homeLambda,
    awayLambda,
    maxGoals,
    homeDistribution: homeDistribution.normalized,
    awayDistribution: awayDistribution.normalized,
    rawMass,
    matrix: normalizedMatrix,
  };
}

export function sumMatrix(matrix) {
  return matrixTotal(matrix);
}

export function projectScoreMatrix(scoreMatrix, projector) {
  if (!scoreMatrix || !Array.isArray(scoreMatrix.matrix)) {
    throw new Error("scoreMatrix must contain a matrix");
  }

  let total = 0;
  for (let homeGoals = 0; homeGoals < scoreMatrix.matrix.length; homeGoals += 1) {
    const row = scoreMatrix.matrix[homeGoals];
    for (let awayGoals = 0; awayGoals < row.length; awayGoals += 1) {
      total += projector({
        homeGoals,
        awayGoals,
        probability: row[awayGoals],
      });
    }
  }
  return total;
}
