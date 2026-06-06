import { buildFixtureKey } from "../lib/match-key.js";

export function mergeMarketSources({ oddsBoard = [], predictionBoard = [] }) {
  const merged = new Map();

  for (const row of oddsBoard) {
    const key = row.fixtureKey || buildFixtureKey(row.home, row.away);
    merged.set(key, {
      id: row.fixtureId || key,
      home: row.home,
      away: row.away,
      kickoff: row.kickoff,
      updatedAtLabel: "实时",
      oddsProviders: row.oddsProviders || [],
      predictionMarkets: [],
    });
  }

  for (const row of predictionBoard) {
    const key = row.fixtureKey || buildFixtureKey(row.home, row.away);
    const current = merged.get(key) || {
      id: row.fixtureId || key,
      home: row.home,
      away: row.away,
      kickoff: row.kickoff,
      updatedAtLabel: "实时",
      oddsProviders: [],
      predictionMarkets: [],
    };

    current.predictionMarkets = row.predictionMarkets || [];
    current.kickoff = current.kickoff || row.kickoff;
    merged.set(key, current);
  }

  return Array.from(merged.values()).filter(
    (row) => row.oddsProviders.length || row.predictionMarkets.length,
  );
}
