import { loadLocalEnv } from "../lib/load-env.js";
import { getProviderAdapters, getMockProvider } from "../providers/provider-registry.js";
import { mergeMarketSources } from "../services/market-board-service.js";
import { validateRawMarketBoard } from "../schemas/market-board.js";
import { getMarketDataBundle, getProviderStatus, getStaticPageData } from "../data-sources.js";

loadLocalEnv();

async function run() {
  const adapters = getProviderAdapters();
  const result = {
    checkedAt: new Date().toISOString(),
    adapters: {},
  };

  for (const [name, adapter] of Object.entries(adapters)) {
    if (!adapter.isConfigured()) {
      result.adapters[name] = { status: "skipped", reason: "provider not configured" };
      continue;
    }

    try {
      if (name === "odds") {
        const rows = await adapter.fetchNormalizedOddsBoard();
        result.adapters[name] = { status: "ok", rows: rows.length };
      } else if (name === "polymarket") {
        const rows = await adapter.fetchNormalizedPredictionMarkets();
        result.adapters[name] = { status: "ok", rows: rows.length };
      } else if (name === "live") {
        const rows = await adapter.fetchNormalizedLiveMatches();
        result.adapters[name] = { status: "ok", rows: rows.length };
      } else if (name === "bzzoiro") {
        const payload = await adapter.fetchSupplementalSignals();
        result.adapters[name] = {
          status: "ok",
          events: payload.events.length,
          predictions: payload.predictions.length,
          bookmakerOddsEvents: payload.bookmakerOddsByEvent.length,
          polymarketOddsEvents: payload.polymarketOddsByEvent.length,
          warnings: payload.warnings,
        };
      } else if (name === "opinions") {
        const rows = await adapter.fetchOpinions();
        result.adapters[name] = { status: "ok", rows: rows.length };
      }
    } catch (error) {
      result.adapters[name] = { status: "error", message: error.message };
    }
  }

  const mockProvider = getMockProvider();
  const mockBoard = mockProvider.getRawMarketBoard();
  const marketBundle = await getMarketDataBundle();
  const staticPageData = await getStaticPageData();
  const providerStatus = await getProviderStatus();
  result.mockValidation = validateRawMarketBoard(mockBoard);
  result.currentModes = {
    market: marketBundle.mode,
    live: staticPageData.liveMode,
  };
  result.providerStatus = providerStatus;
  result.mockMergeCount = mergeMarketSources({
    oddsBoard: [],
    predictionBoard: [],
  }).length;

  console.log(JSON.stringify(result, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
