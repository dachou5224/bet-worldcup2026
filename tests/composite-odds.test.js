import test from "node:test";
import assert from "node:assert/strict";
import { createBzzoiroOddsProviderAdapter } from "../providers/odds/bzzoiro-odds.js";
import { createCompositeOddsProviderAdapter } from "../providers/odds/composite.js";
import { getProviderConfig } from "../provider-config.js";

test("bzzoiro odds adapter falls back to supplemental snapshot", async () => {
  const adapter = createBzzoiroOddsProviderAdapter(getProviderConfig());
  const rows = await adapter.fetchNormalizedOddsBoard();

  assert.ok(rows.length >= 5);
  assert.ok(rows.every((row) => row.oddsProviders.length > 0));
  assert.ok(
    rows.every((row) =>
      row.oddsProviders.every((provider) =>
        provider.markets.every((market) => typeof market.lastUpdate === "string"),
      ),
    ),
  );
  const meta = adapter.getLastFetchMeta();
  assert.ok(meta?.sourceMode === "file_snapshot" || meta?.sourceMode === "real");
});

test("composite odds adapter uses bzzoiro when the odds api is unavailable", async () => {
  const config = {
    ...getProviderConfig(),
    oddsProvider: "auto",
    oddsApiKey: "invalid-key-for-test",
  };
  const adapter = createCompositeOddsProviderAdapter(config);
  const rows = await adapter.fetchNormalizedOddsBoard();

  assert.ok(rows.length >= 5);
  const meta = adapter.getLastFetchMeta();
  assert.equal(meta?.fallbackFrom, "the-odds-api");
  assert.equal(meta?.oddsProvider, "bzzoiro_odds");
});
