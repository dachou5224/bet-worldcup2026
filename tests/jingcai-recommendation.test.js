import test from "node:test";
import assert from "node:assert/strict";
import { buildJingcaiRecommendationsFromMarket } from "../market-pipeline.js";
import { getJingcaiOfficialFeed } from "../data-sources.js";

const rawMarketBoard = [
  {
    id: 10,
    home: "阿根廷",
    away: "波兰",
    kickoff: "2026-06-12 20:00 CST",
    updatedAtLabel: "4 min ago",
    oddsProviders: [
      {
        provider: "Pinnacle",
        updatedAt: "2026-06-06T08:30:00+08:00",
        odds: { home: 1.92, draw: 3.45, away: 4.35 },
        markets: [
          {
            key: "spreads",
            lastUpdate: "2026-06-06T08:30:00+08:00",
            outcomes: [
              { name: "阿根廷", price: 3.40, point: -1 },
              { name: "波兰", price: 1.50, point: 1 },
            ],
          },
        ],
      },
    ],
    predictionMarkets: [
      {
        provider: "Polymarket",
        updatedAt: "2026-06-06T08:28:00+08:00",
        probabilities: { home: 0.47, draw: 0.24, away: 0.29 },
      },
    ],
  },
  {
    id: 11,
    home: "美国",
    away: "摩洛哥",
    kickoff: "2026-06-12 21:30 ET",
    updatedAtLabel: "6 min ago",
    oddsProviders: [
      {
        provider: "Pinnacle",
        updatedAt: "2026-06-06T08:30:00+08:00",
        odds: { home: 2.18, draw: 3.2, away: 3.35 },
      },
    ],
    predictionMarkets: [
      {
        provider: "Polymarket",
        updatedAt: "2026-06-06T08:28:00+08:00",
        probabilities: { home: 0.39, draw: 0.29, away: 0.32 },
      },
    ],
  },
];

test("buildJingcaiRecommendationsFromMarket maps a qualified spread signal to Layer C", () => {
  const recommendations = buildJingcaiRecommendationsFromMarket(rawMarketBoard, getJingcaiOfficialFeed(), {
    now: "2026-06-06T12:00:00+08:00",
    kellyFraction: 1,
  });

  assert.equal(recommendations.length, 2);

  const argentina = recommendations.find((item) => item.fixtureId === 10);
  assert.ok(argentina);
  assert.equal(argentina.noJingcaiReason, null);
  assert.ok(argentina.primaryRecommendation);
  assert.equal(argentina.primaryRecommendation.playType, "让球胜平负");
  assert.equal(argentina.primaryRecommendation.selection, "胜");
  assert.equal(argentina.primaryRecommendation.selectionCode, "3");
  assert.equal(argentina.primaryRecommendation.saleStatus, "on_sale");
  assert.ok(argentina.primaryRecommendation.officialExpectedValue > 0);
  assert.ok(argentina.primaryRecommendation.suggestedStakeUnits >= 1);
  assert.match(argentina.primaryRecommendation.recommendationText, /体彩收敛/);
  assert.match(argentina.primaryRecommendation.recommendationText, /阿根廷 vs 波兰/);
});

test("buildJingcaiRecommendationsFromMarket degrades cleanly when the match is not listed", () => {
  const recommendations = buildJingcaiRecommendationsFromMarket(rawMarketBoard, getJingcaiOfficialFeed(), {
    now: "2026-06-06T12:00:00+08:00",
    kellyFraction: 1,
  });

  const usa = recommendations.find((item) => item.fixtureId === 11);
  assert.ok(usa);
  assert.equal(usa.primaryRecommendation, null);
  assert.equal(usa.noJingcaiReason, "skip_not_in_schedule");
});
