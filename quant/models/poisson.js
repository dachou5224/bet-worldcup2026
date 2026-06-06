function assertLambda(lambda, label) {
  if (!Number.isFinite(lambda) || lambda < 0) {
    throw new Error(`${label} must be a finite number greater than or equal to 0`);
  }
}

function factorial(n) {
  if (n < 0 || !Number.isInteger(n)) {
    throw new Error("n must be a non-negative integer");
  }

  let result = 1;
  for (let i = 2; i <= n; i += 1) {
    result *= i;
  }
  return result;
}

export function poissonPmf(k, lambda) {
  if (!Number.isInteger(k) || k < 0) {
    throw new Error("k must be a non-negative integer");
  }

  assertLambda(lambda, "lambda");

  if (lambda === 0) {
    return k === 0 ? 1 : 0;
  }

  return (Math.exp(-lambda) * lambda ** k) / factorial(k);
}

export function poissonDistribution(lambda, maxGoals = 10) {
  assertLambda(lambda, "lambda");

  if (!Number.isInteger(maxGoals) || maxGoals < 0) {
    throw new Error("maxGoals must be a non-negative integer");
  }

  const distribution = Array.from({ length: maxGoals + 1 }, (_, goals) => ({
    goals,
    probability: poissonPmf(goals, lambda),
  }));

  return distribution;
}

export function normalizeDistribution(distribution) {
  const total = distribution.reduce((sum, item) => sum + item.probability, 0);

  if (total <= 0) {
    throw new Error("Distribution mass must be greater than 0");
  }

  return {
    totalMass: total,
    normalized: distribution.map((item) => ({
      ...item,
      probability: item.probability / total,
    })),
  };
}
