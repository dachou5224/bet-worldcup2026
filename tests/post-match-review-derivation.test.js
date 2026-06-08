import test from "node:test";
import assert from "node:assert/strict";
import { buildPostMatchReviewBundle } from "../lib/post-match-review.js";

test("post-match review derives completed comparisons from finished live matches", () => {
  const liveMatches = [
    {
      id: 1,
      fixture: "墨西哥 vs 日本",
      home: "墨西哥",
      away: "日本",
      status: "已结束",
      homeScore: "2",
      awayScore: "1",
      kickoff: "2026-06-11T20:00:00-05:00",
    },
    {
      id: 2,
      fixture: "美国 vs 摩洛哥",
      home: "美国",
      away: "摩洛哥",
      status: "赛前",
      homeScore: "-",
      awayScore: "-",
      kickoff: "2026-06-11T21:30:00-05:00",
    },
  ];

  const predictions = [
    {
      id: 1,
      fixture: "墨西哥 vs 日本",
      confidence: "high",
      marketHome: 42,
      marketDraw: 28,
      marketAway: 30,
      modelHome: 48,
      modelDraw: 25,
      modelAway: 27,
    },
    {
      id: 2,
      fixture: "美国 vs 摩洛哥",
      confidence: "medium",
      marketHome: 39,
      marketDraw: 31,
      marketAway: 30,
      modelHome: 40,
      modelDraw: 30,
      modelAway: 30,
    },
  ];

  const bundle = buildPostMatchReviewBundle(liveMatches, predictions, [
    {
      fixture: "fallback fixture",
      predicted: "主胜",
      actual: "主胜",
      edge: "+1.0%",
      takeaway: "fallback",
      status: "hit",
    },
  ], {
    liveMode: "real",
  });

  assert.equal(bundle.summary.sourceMode, "live_real");
  assert.equal(bundle.summary.derivedCount, 1);
  assert.equal(bundle.summary.finishedMatchCount, 1);
  assert.equal(bundle.summary.matchedPredictionCount, 1);
  assert.equal(bundle.summary.liveCoverageRate, 1);
  assert.equal(bundle.summary.predictionCoverageRate, 1);
  assert.equal(bundle.completedComparisons.length, 1);
  assert.equal(bundle.completedComparisons[0].fixture, "墨西哥 vs 日本");
  assert.equal(bundle.completedComparisons[0].status, "hit");
  assert.equal(bundle.completedComparisons[0].predicted, "墨西哥胜");
  assert.equal(bundle.completedComparisons[0].actual, "墨西哥胜");
  assert.equal(bundle.completedComparisons[0].finalScore.home, "2");
  assert.equal(bundle.completedComparisons[0].finalScore.away, "1");
});
