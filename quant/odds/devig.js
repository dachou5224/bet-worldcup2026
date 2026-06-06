function normalizeOutcome(outcome, index) {
  if (typeof outcome === "number") {
    return {
      name: `outcome_${index}`,
      decimalOdds: outcome,
    };
  }

  if (!outcome || typeof outcome !== "object") {
    throw new Error("Outcome must be a number or object");
  }

  const decimalOdds =
    outcome.decimalOdds ?? outcome.odds ?? outcome.price ?? outcome.decimal_odds;

  if (!Number.isFinite(decimalOdds) || decimalOdds <= 1) {
    throw new Error("Decimal odds must be a finite number greater than 1");
  }

  return {
    ...outcome,
    name: outcome.name ?? `outcome_${index}`,
    decimalOdds,
  };
}

function normalizeOutcomes(outcomes) {
  if (!Array.isArray(outcomes) || outcomes.length === 0) {
    throw new Error("Outcomes must be a non-empty array");
  }

  return outcomes.map(normalizeOutcome);
}

export function decimalOddsToRawProbabilities(outcomes) {
  return normalizeOutcomes(outcomes).map((outcome) => ({
    ...outcome,
    rawProbability: 1 / outcome.decimalOdds,
  }));
}

export function margin(outcomes) {
  const rawOutcomes = decimalOddsToRawProbabilities(outcomes);
  return rawOutcomes.reduce((sum, outcome) => sum + outcome.rawProbability, 0) - 1;
}

export function proportionalDevig(outcomes) {
  const rawOutcomes = decimalOddsToRawProbabilities(outcomes);
  const totalProbability = rawOutcomes.reduce((sum, outcome) => sum + outcome.rawProbability, 0);

  if (totalProbability <= 0) {
    throw new Error("Total implied probability must be greater than 0");
  }

  return rawOutcomes.map((outcome) => ({
    ...outcome,
    fairProbability: outcome.rawProbability / totalProbability,
  }));
}

export function fairOdds(outcomes) {
  return proportionalDevig(outcomes).map((outcome) => ({
    ...outcome,
    fairOdds: 1 / outcome.fairProbability,
  }));
}
