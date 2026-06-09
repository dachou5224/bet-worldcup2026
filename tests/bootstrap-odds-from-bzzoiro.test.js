import test from "node:test";
import assert from "node:assert/strict";
import {
  buildOddsSnapshotFromBzzoiro,
  convertBzzoiroBookmakerOddsToOddsApiEvents,
} from "../lib/bootstrap-odds-from-bzzoiro.js";
import { createTheOddsApiProviderAdapter } from "../providers/odds/the-odds-api.js";
import { getProviderConfig } from "../provider-config.js";

test("convertBzzoiroBookmakerOddsToOddsApiEvents produces odds-api wire format", () => {
  const events = convertBzzoiroBookmakerOddsToOddsApiEvents([
    {
      event: {
        id: 8287,
        home_team: "Mexico",
        away_team: "South Africa",
        event_date: "2026-06-11T19:00:00Z",
      },
      odds: [
        {
          market: "1x2",
          outcome: "HOME",
          bookmaker: "Pinnacle",
          bookmakerCode: "pinnacle",
          decimalOdds: 1.425,
          updatedAt: "2026-06-08T08:08:57.553445Z",
        },
        {
          market: "1x2",
          outcome: "DRAW",
          bookmaker: "Pinnacle",
          bookmakerCode: "pinnacle",
          decimalOdds: 4.55,
          updatedAt: "2026-06-08T08:08:57.553445Z",
        },
        {
          market: "1x2",
          outcome: "AWAY",
          bookmaker: "Pinnacle",
          bookmakerCode: "pinnacle",
          decimalOdds: 8.51,
          updatedAt: "2026-06-08T08:08:57.632842Z",
        },
      ],
    },
  ]);

  assert.equal(events.length, 1);
  assert.equal(events[0].home_team, "Mexico");
  assert.equal(events[0].bookmakers[0].markets[0].key, "h2h");
  assert.equal(events[0].bookmakers[0].markets[0].outcomes.length, 3);
});

test("buildOddsSnapshotFromBzzoiro reads supplemental snapshot fallback", () => {
  const snapshot = buildOddsSnapshotFromBzzoiro();
  assert.ok(Array.isArray(snapshot.payload));
  assert.ok(snapshot.payload.length >= 5);
  assert.equal(snapshot.source, "bzzoiro-bookmaker-odds");
  assert.equal(snapshot.sourceMode, "file");
});

test("bootstrapped odds snapshot normalizes through the odds adapter", async () => {
  const snapshot = buildOddsSnapshotFromBzzoiro();
  const adapter = createTheOddsApiProviderAdapter(getProviderConfig());
  adapter.fetchRawOddsBoard = async () => snapshot.payload;
  const rows = await adapter.fetchNormalizedOddsBoard();

  assert.ok(rows.length >= 5);
  assert.ok(rows.every((row) => row.oddsProviders.length > 0));
});
