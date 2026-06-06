import { priceH2H } from "./h2h.js";
import { priceSpread } from "./spread.js";
import { priceTotal } from "./total.js";

export function priceMarkets(scoreMatrix, { spreadLine = 0, totalLine = 2.5 } = {}) {
  return {
    h2h: priceH2H(scoreMatrix),
    spread: priceSpread(scoreMatrix, spreadLine),
    total: priceTotal(scoreMatrix, totalLine),
  };
}
