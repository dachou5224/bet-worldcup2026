import test from "node:test";
import assert from "node:assert/strict";
import { resolveJingcaiOfficialFeedMode, isJingcaiRealFeedMode } from "../lib/jingcai-feed-mode.js";
import { deriveResearchSafetyState } from "../data-hub.js";

test("resolveJingcaiOfficialFeedMode uses file for replay and webapi for real", () => {
  assert.equal(
    resolveJingcaiOfficialFeedMode({ marketDataMode: "replay", liveDataMode: "replay" }),
    "file",
  );
  assert.equal(
    resolveJingcaiOfficialFeedMode({ marketDataMode: "real", liveDataMode: "real" }),
    "webapi",
  );
  assert.equal(
    resolveJingcaiOfficialFeedMode({
      jingcaiOfficialFeedMode: "file",
      marketDataMode: "real",
      liveDataMode: "real",
    }),
    "file",
  );
});

test("isJingcaiRealFeedMode treats webapi as live official source", () => {
  assert.equal(isJingcaiRealFeedMode("webapi"), true);
  assert.equal(isJingcaiRealFeedMode("real"), true);
  assert.equal(isJingcaiRealFeedMode("file"), false);
});

test("deriveResearchSafetyState accepts webapi as full research jingcai source", () => {
  const state = deriveResearchSafetyState(
    {
      appMode: "research",
      marketDataMode: "real",
      jingcaiOfficialFeedMode: "webapi",
      jingcaiFallbackUsed: false,
    },
    "real",
  );

  assert.equal(state.researchSafe, true);
  assert.equal(state.researchSafeStatus, "full");
  assert.equal(state.fallbackUsed.jingcai, false);
  assert.ok(!state.researchSafeBlockReasons.includes("jingcai_not_real"));
});

test("deriveResearchSafetyState marks webapi file fallback as partial blocked", () => {
  const state = deriveResearchSafetyState(
    {
      appMode: "research",
      marketDataMode: "real",
      jingcaiOfficialFeedMode: "webapi",
      jingcaiFallbackUsed: true,
    },
    "real",
  );

  assert.equal(state.researchSafe, false);
  assert.equal(state.fallbackUsed.jingcai, true);
  assert.ok(state.researchSafeBlockReasons.includes("jingcai_fallback_used"));
});
