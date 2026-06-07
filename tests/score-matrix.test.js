import test from "node:test";
import assert from "node:assert/strict";
import { buildScoreMatrix, sumMatrix } from "../quant/models/score-matrix.js";
import { priceH2H } from "../quant/pricing/h2h.js";
import { priceSpread } from "../quant/pricing/spread.js";
import { priceTotal } from "../quant/pricing/total.js";
import { priceCorrectScore } from "../quant/pricing/correct-score.js";
import { priceMarkets } from "../quant/pricing/markets.js";
import { priceJingcaiRqspf } from "../quant/pricing/jingcai-rqspf.js";

const scoreMatrix = buildScoreMatrix({ homeLambda: 1.35, awayLambda: 1.08, maxGoals: 10 });

test("buildScoreMatrix normalizes to a probability mass of 1", () => {
  assert.ok(Math.abs(sumMatrix(scoreMatrix.matrix) - 1) < 1e-12);
  assert.ok(Math.abs(scoreMatrix.homeDistribution.reduce((sum, item) => sum + item.probability, 0) - 1) < 1e-12);
  assert.ok(Math.abs(scoreMatrix.awayDistribution.reduce((sum, item) => sum + item.probability, 0) - 1) < 1e-12);
});

test("priceH2H returns a three-way market that sums to 1", () => {
  const priced = priceH2H(scoreMatrix);

  assert.equal(priced.marketType, "h2h");
  assert.equal(priced.outcomes.length, 3);
  assert.ok(Math.abs(priced.probabilitySum - 1) < 1e-12);
  assert.ok(priced.outcomes.every((outcome) => outcome.fairOdds > 1));
});

test("priceSpread handles half-line and quarter-line settlements", () => {
  const halfLine = priceSpread(scoreMatrix, -0.5);
  const quarterLine = priceSpread(scoreMatrix, 0.25);

  assert.equal(halfLine.marketType, "spread");
  assert.ok(Math.abs(halfLine.home.fullWin + halfLine.home.push + halfLine.home.fullLoss - 1) < 1e-12);
  assert.ok(Math.abs(halfLine.away.fullWin + halfLine.away.push + halfLine.away.fullLoss - 1) < 1e-12);
  assert.ok(halfLine.home.fairOdds > 1);
  assert.ok(quarterLine.home.halfWin > 0 || quarterLine.home.halfLoss > 0);
  assert.ok(
    Math.abs(
      quarterLine.home.fullWin +
        quarterLine.home.halfWin +
        quarterLine.home.push +
        quarterLine.home.halfLoss +
        quarterLine.home.fullLoss -
        1,
    ) < 1e-12,
  );
});

test("priceTotal handles push and quarter lines", () => {
  const pushLine = priceTotal(scoreMatrix, 2.5);
  const quarterLine = priceTotal(scoreMatrix, 2.25);

  assert.equal(pushLine.marketType, "total");
  assert.ok(Math.abs(pushLine.over.fullWin + pushLine.over.push + pushLine.over.fullLoss - 1) < 1e-12);
  assert.equal(pushLine.over.push, 0);
  assert.ok(quarterLine.over.halfLoss > 0 || quarterLine.over.halfWin > 0);
  assert.ok(
    Math.abs(
      quarterLine.over.fullWin +
        quarterLine.over.halfWin +
        quarterLine.over.push +
        quarterLine.over.halfLoss +
        quarterLine.over.fullLoss -
        1,
    ) < 1e-12,
  );
});

test("priceMarkets and Jingcai projection reuse the same score matrix", () => {
  const markets = priceMarkets(scoreMatrix, {
    spreadLine: -0.25,
    totalLine: 2.75,
    correctScores: [
      { homeGoals: 1, awayGoals: 0 },
      { home: 2, away: 1 },
    ],
  });
  const jingcai = priceJingcaiRqspf(scoreMatrix, -1);
  const correctScore = priceCorrectScore(scoreMatrix, { homeGoals: 1, awayGoals: 0 });

  assert.equal(markets.h2h.marketType, "h2h");
  assert.equal(markets.spread.marketType, "spread");
  assert.equal(markets.total.marketType, "total");
  assert.equal(markets.correctScore.marketType, "correct_score");
  assert.equal(jingcai.marketType, "jingcai_rqspf");
  assert.equal(jingcai.outcomes.length, 3);
  assert.ok(Math.abs(jingcai.probabilitySum - 1) < 1e-12);
  assert.ok(jingcai.outcomes[0].fairOdds > 1);
  assert.equal(correctScore.outcomes.length, 1);
  assert.ok(correctScore.probabilitySum > 0);
});
