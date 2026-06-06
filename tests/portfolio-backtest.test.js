import test from "node:test";
import assert from "node:assert/strict";
import { buildPortfolioExposure } from "../quant/portfolio/exposure.js";
import { settleMarketBet } from "../quant/backtest/settlement.js";
import { settleJingcaiRecommendation } from "../quant/backtest/jingcai-settlement.js";
import { computeBrier, computeClosingLineValue, computeLogLoss } from "../quant/backtest/metrics.js";
import { buildBacktestReview, buildPortfolioReview } from "../data-hub.js";
import { buildApiPayload } from "../services/api-service.js";

test("portfolio exposure aggregates accepted signals and rejects negative EV", () => {
  const portfolio = buildPortfolioExposure(
    [
      {
        fixtureId: 1,
        fixture: "墨西哥 vs 日本",
        kickoffLocal: "2026-06-11T20:00:00-05:00",
        marketType: "spread",
        line: -1,
        outcome: "home",
        recommendationLevel: "SMALL_POSITION",
        officialExpectedValue: 0.08,
        officialFinalStakeFraction: 0.02,
      },
      {
        fixtureId: 2,
        fixture: "美国 vs 摩洛哥",
        kickoffLocal: "2026-06-11T21:30:00-05:00",
        marketType: "total",
        line: 2.5,
        outcome: "under",
        recommendationLevel: "CANDIDATE",
        officialExpectedValue: 0.06,
        officialFinalStakeFraction: 0.015,
      },
      {
        fixtureId: 3,
        fixture: "阿根廷 vs 波兰",
        kickoffLocal: "2026-06-12T20:00:00-05:00",
        marketType: "h2h",
        outcome: "away",
        recommendationLevel: "WATCH",
        officialExpectedValue: -0.02,
        officialFinalStakeFraction: 0.01,
      },
    ],
    {
      totalRiskBudget: 0.03,
      singleMatchBudget: 0.02,
      dayBudget: 0.03,
      factorBudget: 0.02,
      generatedAt: "2026-06-06T12:00:00+08:00",
    },
  );

  assert.equal(portfolio.candidateSignals.length, 2);
  assert.ok(portfolio.exposureByFactor.favorite_bias > 0);
  assert.ok(portfolio.exposureByFactor.low_total_bias > 0);
  assert.equal(portfolio.rejectedSignals[0].reason, "negative_or_missing_ev");
  assert.match(portfolio.portfolioCommentary, /组合层/);
});

test("settlement and metrics cover h2h, spread, total and calibration", () => {
  const h2h = settleMarketBet(
    {
      marketType: "h2h",
      selectionCode: "3",
      finalScore: { home: 2, away: 1 },
      officialOddsAtRecommendation: 2.04,
      stakeUnits: 1,
    },
    { finalScore: { home: 2, away: 1 }, odds: 2.0, stakeUnits: 1 },
  );
  assert.equal(h2h.settlement, "won");
  assert.equal(h2h.resultCode, "3");

  const spread = settleMarketBet(
    {
      marketType: "spread",
      selectionCode: "3",
      handicap: -1,
      finalScore: { home: 2, away: 0 },
      officialOddsAtRecommendation: 3.35,
      stakeUnits: 1,
    },
    { finalScore: { home: 2, away: 0 }, handicap: -1, odds: 3.25, stakeUnits: 1 },
  );
  assert.equal(spread.settlement, "won");
  assert.equal(spread.resultCode, "3");

  const total = settleMarketBet(
    {
      marketType: "total",
      selection: "under",
      line: 2.5,
      finalScore: { home: 1, away: 1 },
      officialOddsAtRecommendation: 1.92,
      stakeUnits: 1,
    },
    { finalScore: { home: 1, away: 1 }, line: 2.5, odds: 1.92, stakeUnits: 1 },
  );
  assert.equal(total.settlement, "won");
  assert.equal(total.resultCode, "0");

  const jingcai = settleJingcaiRecommendation(
    {
      primaryRecommendation: {
        playType: "让球胜平负",
        selection: "胜",
        selectionCode: "3",
        handicap: -1,
        officialOdds: 3.35,
        suggestedStakeUnits: 1,
      },
    },
    {
      finalScore: { home: 2, away: 0 },
      officialOddsAtRecommendation: 3.35,
      officialOddsAtStopSale: 3.25,
      stakeUnits: 1,
    },
  );
  assert.equal(jingcai.settlement, "won");
  assert.equal(jingcai.resultCode, "3");
  assert.ok(jingcai.realizedReturnOfficial > 0);

  assert.equal(computeBrier({ home: 0.46, draw: 0.28, away: 0.26 }, "home"), 0.4376);
  assert.equal(computeLogLoss({ home: 0.46, draw: 0.28, away: 0.26 }, "home"), 0.7765);
  assert.equal(computeClosingLineValue(2.04, 2.0), 0.04);
});

test("portfolio and backtest summaries are exposed from data hub", async () => {
  const [portfolioReview, backtestReview] = await Promise.all([buildPortfolioReview(), buildBacktestReview()]);

  assert.ok(portfolioReview.candidateSignals.length >= 0);
  assert.ok(typeof portfolioReview.portfolioCommentary === "string");
  assert.ok(backtestReview.recordCount > 0);
  assert.ok(backtestReview.records.every((record) => record.jingcaiSettlement));
  assert.ok(backtestReview.meanBrier !== null);
  assert.ok(backtestReview.meanLogLoss !== null);
  assert.ok(backtestReview.meanClv !== null);
});

test("api exposes portfolio and backtest review endpoints", async () => {
  const api = await buildApiPayload();
  const portfolioReview = await api["/api/data/portfolio-review"]();
  const backtestReview = await api["/api/data/backtest-review"]();

  assert.ok(portfolioReview.portfolioId);
  assert.ok(backtestReview.recordCount > 0);
  assert.ok(Array.isArray(backtestReview.records));
});
