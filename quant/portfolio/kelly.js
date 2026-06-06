import { expectedValue } from "../edge/ev.js";

function assertProbability(value) {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error("Probability must be between 0 and 1");
  }
}

function assertDecimalOdds(decimalOdds) {
  if (!Number.isFinite(decimalOdds) || decimalOdds <= 1) {
    throw new Error("Decimal odds must be a finite number greater than 1");
  }
}

export function fullKelly(decimalOdds, probability) {
  assertDecimalOdds(decimalOdds);
  assertProbability(probability);

  if (expectedValue(decimalOdds, probability) <= 0) {
    return 0;
  }

  const b = decimalOdds - 1;
  const q = 1 - probability;
  const stake = (b * probability - q) / b;

  return Math.max(0, stake);
}

export function fractionalKelly(decimalOdds, probability, fraction) {
  if (!Number.isFinite(fraction) || fraction < 0 || fraction > 1) {
    throw new Error("Fraction must be between 0 and 1");
  }

  return fullKelly(decimalOdds, probability) * fraction;
}

export function capStake(rawStake, { singleBetCap = 1, matchCap = 1, dayCap = 1 } = {}) {
  if (!Number.isFinite(rawStake)) {
    throw new Error("Raw stake must be finite");
  }

  for (const [label, value] of Object.entries({ singleBetCap, matchCap, dayCap })) {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`${label} must be a finite number greater than or equal to 0`);
    }
  }

  return Math.min(Math.max(0, rawStake), singleBetCap, matchCap, dayCap);
}
