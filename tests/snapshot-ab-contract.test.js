import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAbProviderStatusEnvelope,
  validateAbLiveDataSnapshot,
  validateAbOddsRawSnapshot,
  validateAbProviderStatusSnapshot,
  withAbLiveDataEnvelope,
  withAbOddsRawEnvelope,
} from "../lib/snapshot-ab-contract.js";

test("withAbLiveDataEnvelope exposes liveData.liveMatches for Agent A", () => {
  const snapshot = withAbLiveDataEnvelope({
    capturedAt: "2026-06-09T00:00:00.000Z",
    sourceMode: "real",
    payload: {
      liveMode: "real",
      liveMatches: [{ id: 1, home: "墨西哥", away: "南非" }],
    },
  });

  assert.deepEqual(snapshot.liveData.liveMatches, snapshot.payload.liveMatches);
  assert.deepEqual(validateAbLiveDataSnapshot(snapshot), []);
});

test("withAbOddsRawEnvelope exposes body and request for Agent A", () => {
  const snapshot = withAbOddsRawEnvelope(
    {
      capturedAt: "2026-06-09T00:00:00.000Z",
      payload: [{ id: "8287", home_team: "Mexico", away_team: "South Africa" }],
    },
    {
      sportKey: "soccer_fifa_world_cup",
      regions: "eu",
      markets: ["h2h"],
      commenceTimeFrom: "2026-06-11T00:00:00Z",
      commenceTimeTo: "2026-07-19T23:59:59Z",
    },
  );

  assert.equal(snapshot.body.length, 1);
  assert.deepEqual(snapshot.request.markets, ["h2h"]);
  assert.deepEqual(validateAbOddsRawSnapshot(snapshot), []);
});

test("buildAbProviderStatusEnvelope exposes sourceMode and fallbackUsed", () => {
  const envelope = buildAbProviderStatusEnvelope({
    capturedAt: "2026-06-09T00:00:00.000Z",
    providerStatus: { marketDataMode: "real", appMode: "research" },
    providerConfig: { appMode: "research", jingcaiOfficialFeedMode: "file" },
    liveMode: "real",
  });

  assert.equal(envelope.sourceMode.market, "real");
  assert.equal(envelope.sourceMode.jingcai, "file");
  assert.equal(envelope.fallbackUsed.market, false);
  assert.deepEqual(validateAbProviderStatusSnapshot(envelope), []);
  assert.equal(typeof envelope.fallbackUsed.any, "boolean");
});
