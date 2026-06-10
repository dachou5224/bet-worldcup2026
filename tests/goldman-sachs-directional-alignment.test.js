import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDirectionalAlignmentForPrediction,
  buildGoldmanJoinedIndex,
  extractMarketH2hFromBaseline,
} from "../lib/goldman-sachs-directional-alignment.js";
import { buildRecommendationSnapshot } from "../quant/output/recommendation-snapshot.js";

const SAMPLE_INDEX = buildGoldmanJoinedIndex({
  joinedMatches: [
    {
      fixtureId: 8287,
      pairKey: "Mexico__South Africa",
      group: "A",
      matchDay: 1,
      scoreline: "2-0",
      gsOutcome: "home",
      gsResultType: "home_win",
      marketH2h: { home: 0.66, draw: 0.22, away: 0.12 },
      marketLean: "home",
    },
    {
      fixtureId: 8288,
      pairKey: "South Korea__Czechia",
      group: "A",
      matchDay: 1,
      scoreline: "1-1",
      gsOutcome: "draw",
      gsResultType: "draw",
      marketH2h: { home: 0.45, draw: 0.28, away: 0.27 },
      marketLean: "home",
    },
  ],
});

test("buildDirectionalAlignmentForPrediction compares GS modal with market lean", () => {
  const aligned = buildDirectionalAlignmentForPrediction(
    {
      id: 8287,
      marketBaseline: {
        pricing: {
          outcomes: [
            { name: "home", probability: 0.664 },
            { name: "draw", probability: 0.219 },
            { name: "away", probability: 0.117 },
          ],
        },
      },
    },
    { index: SAMPLE_INDEX },
  );

  assert.equal(aligned.status, "ready");
  assert.equal(aligned.directionalAlignment, "aligned");
  assert.equal(aligned.scoreline, "2-0");
  assert.equal(aligned.marketLean, "home");

  const divergent = buildDirectionalAlignmentForPrediction({ id: 8288 }, { index: SAMPLE_INDEX });
  assert.equal(divergent.directionalAlignment, "divergent");
  assert.equal(divergent.gsOutcome, "draw");
});

test("buildRecommendationSnapshot exposes fundamentalDirectionalAlignment", () => {
  const snapshot = buildRecommendationSnapshot({
    id: 8287,
    fixture: "墨西哥 vs 南非",
    kickoff: "2026-06-12T03:00:00+08:00",
    confidence: "high",
    summary: "sample",
    marketBaseline: {
      pricing: {
        outcomes: [
          { name: "home", probability: 0.664 },
          { name: "draw", probability: 0.219 },
          { name: "away", probability: 0.117 },
        ],
      },
    },
  });

  assert.ok(snapshot.fundamentalDirectionalAlignment);
  assert.equal(snapshot.fundamentalDirectionalAlignment.status, "ready");
  assert.equal(snapshot.fundamentalDirectionalAlignment.directionalAlignment, "aligned");
});

test("extractMarketH2hFromBaseline reads pricing outcomes", () => {
  const marketH2h = extractMarketH2hFromBaseline({
    pricing: {
      outcomes: [
        { name: "home", probability: 0.5 },
        { name: "draw", probability: 0.3 },
        { name: "away", probability: 0.2 },
      ],
    },
  });

  assert.equal(marketH2h.home, 0.5);
  assert.equal(marketH2h.draw, 0.3);
});
