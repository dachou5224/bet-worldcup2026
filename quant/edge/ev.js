function assertProbability(value, label) {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${label} must be between 0 and 1`);
  }
}

export function expectedValue(decimalOdds, modelProbability) {
  if (!Number.isFinite(decimalOdds) || decimalOdds <= 1) {
    throw new Error("Decimal odds must be a finite number greater than 1");
  }

  assertProbability(modelProbability, "Model probability");

  return modelProbability * (decimalOdds - 1) - (1 - modelProbability);
}

export function edge(modelProbability, marketProbability) {
  assertProbability(modelProbability, "Model probability");
  assertProbability(marketProbability, "Market probability");
  return modelProbability - marketProbability;
}

export function relativeEdge(modelProbability, marketProbability) {
  assertProbability(modelProbability, "Model probability");
  assertProbability(marketProbability, "Market probability");

  if (marketProbability === 0) {
    throw new Error("Market probability must be greater than 0");
  }

  return modelProbability / marketProbability - 1;
}

export function shrinkProbability(modelProbability, marketProbability, lambda) {
  assertProbability(modelProbability, "Model probability");
  assertProbability(marketProbability, "Market probability");

  if (!Number.isFinite(lambda) || lambda < 0 || lambda > 1) {
    throw new Error("Lambda must be between 0 and 1");
  }

  return lambda * modelProbability + (1 - lambda) * marketProbability;
}
