import { priceH2H } from "./h2h.js";
import { priceCorrectScore } from "./correct-score.js";
import { priceSpread } from "./spread.js";
import { priceTotal } from "./total.js";

export function priceMarkets(scoreMatrix, { spreadLine = 0, totalLine = 2.5, correctScores = [] } = {}) {
  return {
    h2h: priceH2H(scoreMatrix),
    spread: priceSpread(scoreMatrix, spreadLine),
    total: priceTotal(scoreMatrix, totalLine),
    correctScore: priceCorrectScore(scoreMatrix, correctScores),
  };
}
