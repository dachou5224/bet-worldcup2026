import test from "node:test";
import assert from "node:assert/strict";
import { buildJingcaiRecommendationsFromMarket } from "../market-pipeline.js";
import { getJingcaiOfficialFeed } from "../data-sources.js";

test("buildJingcaiRecommendationsFromMarket maps a qualified spread signal to Layer C", async () => {
  const officialFeed = await getJingcaiOfficialFeed();
  const targetMatch = officialFeed.find((item) => item.fixtureId === 8287);
  assert.ok(targetMatch);

  const rawMarketBoard = [
    {
      id: targetMatch.fixtureId,
      home: targetMatch.homeTeam,
      away: targetMatch.awayTeam,
      kickoff: "2026-06-12 20:00 CST",
      updatedAtLabel: "4 min ago",
      oddsProviders: [
          {
            provider: "Pinnacle",
            updatedAt: "2026-06-06T08:30:00+08:00",
            odds: { home: 1.35, draw: 3.2, away: 4.0 },
            markets: [
              {
                key: "spreads",
                lastUpdate: "2026-06-06T08:30:00+08:00",
                outcomes: [
                  { name: targetMatch.homeTeam, price: 1.6, point: -1 },
                  { name: targetMatch.awayTeam, price: 2.6, point: 1 },
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
  ];

  const recommendations = buildJingcaiRecommendationsFromMarket(rawMarketBoard, officialFeed, {
    now: "2026-06-06T12:00:00+08:00",
    evThresholdOff: 0,
    kellyFraction: 1,
  });

  assert.equal(recommendations.length, 1);

  const mexico = recommendations.find((item) => item.fixtureId === targetMatch.fixtureId);
  assert.ok(mexico);
  assert.equal(mexico.noJingcaiReason, null);
  assert.ok(mexico.primaryRecommendation);
  assert.equal(mexico.primaryRecommendation.playType, "让球胜平负");
  assert.equal(mexico.primaryRecommendation.selection, "负");
  assert.equal(mexico.primaryRecommendation.selectionCode, "0");
  assert.equal(mexico.primaryRecommendation.saleStatus, "on_sale");
  assert.ok(mexico.primaryRecommendation.officialExpectedValue > 0);
  assert.ok(mexico.primaryRecommendation.suggestedStakeUnits >= 1);
  assert.match(mexico.primaryRecommendation.recommendationText, /体彩收敛/);
  assert.match(mexico.primaryRecommendation.recommendationText, /墨西哥 vs 南非/);
});

test("buildJingcaiRecommendationsFromMarket matches fixture ids across string and number forms", async () => {
  const officialFeed = await getJingcaiOfficialFeed();
  const targetMatch = officialFeed.find((item) => item.fixtureId === 8287);
  assert.ok(targetMatch);

  const rawMarketBoard = [
    {
      id: String(targetMatch.fixtureId),
      home: targetMatch.homeTeam,
      away: targetMatch.awayTeam,
      kickoff: "2026-06-12 20:00 CST",
      updatedAtLabel: "4 min ago",
      oddsProviders: [
        {
          provider: "Pinnacle",
          updatedAt: "2026-06-06T08:30:00+08:00",
          odds: { home: 1.35, draw: 3.2, away: 4.0 },
          markets: [
            {
              key: "spreads",
              lastUpdate: "2026-06-06T08:30:00+08:00",
              outcomes: [
                { name: targetMatch.homeTeam, price: 1.6, point: -1 },
                { name: targetMatch.awayTeam, price: 2.6, point: 1 },
              ],
            },
          ],
        },
      ],
      predictionMarkets: [],
    },
  ];

  const recommendations = buildJingcaiRecommendationsFromMarket(rawMarketBoard, officialFeed, {
    now: "2026-06-06T12:00:00+08:00",
    evThresholdOff: 0,
    kellyFraction: 1,
  });

  assert.equal(recommendations.length, 1);
  const match = recommendations[0];
  assert.equal(match.fixtureId, String(targetMatch.fixtureId));
  assert.equal(match.noJingcaiReason, null);
  assert.ok(match.primaryRecommendation);
  assert.equal(match.primaryRecommendation.saleStatus, "on_sale");
});

test("buildJingcaiRecommendationsFromMarket degrades cleanly when the match is not listed", async () => {
  const recommendations = buildJingcaiRecommendationsFromMarket(
    [
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
    ],
    await getJingcaiOfficialFeed(),
    {
    now: "2026-06-06T12:00:00+08:00",
    kellyFraction: 1,
    },
  );

  const usa = recommendations.find((item) => item.fixtureId === 11);
  assert.ok(usa);
  assert.equal(usa.primaryRecommendation, null);
  assert.equal(usa.noJingcaiReason, "skip_not_in_schedule");
});
