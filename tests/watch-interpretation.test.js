import assert from "node:assert/strict";
import test from "node:test";
import { buildWatchInterpretationPrompt, buildLocalWatchInterpretation } from "../lib/watch-interpretation.js";

test("watch interpretation prompt includes edge breakdown and outcome labels", () => {
  const prompt = buildWatchInterpretationPrompt({
    fixture: "澳大利亚 vs 土耳其",
    outcome: "home",
    marketProbability: 0.4924,
    modelProbability: 0.5087,
    adjustedProbability: 0.4992,
    expectedValue: 0.0263,
    decisionCode: "watch_ev_too_low",
    recommendationLevel: "WATCH",
    riskTags: ["no_primary_snapshot"],
    watchEdgeBreakdown: {
      outcomes: [
        {
          outcome: "home",
          label: "主胜",
          marketProbability: 0.4924,
          modelProbability: 0.5087,
          adjustedProbability: 0.4992,
          edgePercentPoint: 0.68,
          expectedValue: 0.0263,
        },
        {
          outcome: "draw",
          label: "平局",
          marketProbability: 0.285,
          modelProbability: 0.281,
          adjustedProbability: 0.2829,
          edgePercentPoint: -0.21,
          expectedValue: -0.014,
        },
      ],
    },
  });

  assert.match(prompt, /澳大利亚 vs 土耳其/);
  assert.match(prompt, /主胜/);
  assert.match(prompt, /平局/);
  assert.match(prompt, /百分点/);
  assert.match(prompt, /watch_ev_too_low/);
});

test("local watch interpretation falls back to recommendation text", () => {
  const text = buildLocalWatchInterpretation({
    recommendationText: "这是一个观察样本。",
  });

  assert.equal(text, "这是一个观察样本。");
});
