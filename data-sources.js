import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getProviderConfig } from "./provider-config.js";
import { allowsProviderFallback } from "./lib/app-mode.js";
import { mergeMarketSources } from "./services/market-board-service.js";
import { validateRawMarketBoard } from "./schemas/market-board.js";
import { getMockProvider, getProviderAdapters } from "./providers/provider-registry.js";
import { loadJingcaiOfficialFeed } from "./providers/jingcai/official-feed.js";
import { getBacktestRun as getMockBacktestRun } from "./providers/mock/index.js";
import { validateLiveMatches } from "./schemas/live-matches.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function readJsonFixture(relativePath) {
  const absolutePath = path.resolve(__dirname, relativePath);

  if (!existsSync(absolutePath)) {
    throw new Error(`Fixture file not found: ${absolutePath}`);
  }

  return JSON.parse(readFileSync(absolutePath, "utf-8"));
}

function validateOrThrowRawMarketBoard(rawMarketBoard, errorPrefix) {
  const validation = validateRawMarketBoard(rawMarketBoard);

  if (!validation.ok) {
    throw new Error(`${errorPrefix}: ${validation.errors.join("; ")}`);
  }

  return rawMarketBoard;
}

function shouldFallbackToMock(config) {
  return allowsProviderFallback(config.appMode);
}

async function getRealMarketDataBundle() {
  const adapters = getProviderAdapters();
  const oddsConfigured = adapters.odds.isConfigured();
  const polymarketConfigured = adapters.polymarket.isConfigured();
  const providerHealth = {
    oddsConfigured,
    polymarketConfigured,
  };

  if (!oddsConfigured && !polymarketConfigured) {
    throw new Error("真实市场模式未配置任何可用 provider");
  }

  let oddsBoard = [];
  let predictionBoard = [];

  if (oddsConfigured) {
    try {
      oddsBoard = await adapters.odds.fetchNormalizedOddsBoard();
      providerHealth.oddsStatus = "ok";
      providerHealth.oddsRows = oddsBoard.length;
    } catch (error) {
      providerHealth.oddsStatus = "error";
      providerHealth.oddsError = error.message;
    }
  } else {
    providerHealth.oddsStatus = "skipped";
  }

  if (polymarketConfigured) {
    try {
      predictionBoard = await adapters.polymarket.fetchNormalizedPredictionMarkets();
      providerHealth.polymarketStatus = "ok";
      providerHealth.polymarketRows = predictionBoard.length;
    } catch (error) {
      providerHealth.polymarketStatus = "error";
      providerHealth.polymarketError = error.message;
    }
  } else {
    providerHealth.polymarketStatus = "skipped";
  }

  const rawMarketBoard = mergeMarketSources({ oddsBoard, predictionBoard });

  if (!rawMarketBoard.length) {
    throw new Error(
      `真实市场模式返回了 0 场可用比赛; odds=${providerHealth.oddsStatus}; polymarket=${providerHealth.polymarketStatus}`,
    );
  }

  validateOrThrowRawMarketBoard(rawMarketBoard, "真实模式市场数据不合法");

  return {
    mode: "real",
    rawMarketBoard,
    providerHealth: {
      ...providerHealth,
      mergedFixtureCount: rawMarketBoard.length,
    },
  };
}

export async function getMarketDataBundle() {
  const config = getProviderConfig();

  if (config.marketDataMode === "file") {
    const rawMarketBoard = validateOrThrowRawMarketBoard(
      readJsonFixture(config.rawMarketBoardFile),
      "文件模式市场数据不合法",
    );

    return {
      mode: "file",
      rawMarketBoard,
      providerHealth: {
        source: "file",
      },
    };
  }

  if (config.marketDataMode === "real") {
    try {
      return await getRealMarketDataBundle();
    } catch (error) {
      if (!shouldFallbackToMock(config)) {
        throw new Error(`research 模式下市场数据请求失败: ${error.message}`);
      }

      const mockProvider = getMockProvider();
      return {
        mode: "real_fallback_mock",
        rawMarketBoard: mockProvider.getRawMarketBoard(),
        providerHealth: {
          source: "fallback_mock",
          reason: error.message,
        },
      };
    }
  }

  const provider = getMockProvider();

  return {
    mode: "mock",
    rawMarketBoard: provider.getRawMarketBoard(),
    providerHealth: {
      source: "mock",
    },
  };
}

export function getSourceCatalog() {
  const config = getProviderConfig();
  return readJsonFixture(config.sourceCatalogFile);
}

export function getJingcaiOfficialFeed() {
  const config = getProviderConfig();
  return loadJingcaiOfficialFeed(config.jingcaiOfficialFeedFile);
}

export function getBacktestRun() {
  return getMockBacktestRun();
}

export async function getSupplementalSignals() {
  const adapters = getProviderAdapters();
  const provider = adapters.bzzoiro;

  if (!provider.isConfigured()) {
    return {
      source: "bzzoiro",
      status: "skipped",
      reason: "provider not configured",
      checkedAt: new Date().toISOString(),
      events: [],
      predictions: [],
      bookmakerOddsByEvent: [],
      polymarketOddsByEvent: [],
      warnings: [],
    };
  }

  try {
    const payload = await provider.fetchSupplementalSignals();
    return {
      source: "bzzoiro",
      status: "ok",
      ...payload,
    };
  } catch (error) {
    return {
      source: "bzzoiro",
      status: "error",
      message: error.message,
      checkedAt: new Date().toISOString(),
      events: [],
      predictions: [],
      bookmakerOddsByEvent: [],
      polymarketOddsByEvent: [],
      warnings: [],
    };
  }
}

async function getRealLiveMatches() {
  const adapters = getProviderAdapters();
  if (!adapters.live.isConfigured()) {
    return null;
  }

  const liveMatches = await adapters.live.fetchNormalizedLiveMatches();
  const validation = validateLiveMatches(liveMatches);

  if (!validation.ok) {
    throw new Error(`真实 live 数据不合法: ${validation.errors.join("; ")}`);
  }

  return liveMatches;
}

export async function getStaticPageData() {
  const config = getProviderConfig();
  const mockData = getMockProvider().getStaticPageData();

  if (config.liveDataMode !== "real") {
    return {
      ...mockData,
      liveMode: "mock",
    };
  }

  try {
    const liveMatches = await getRealLiveMatches();
    if (!liveMatches) {
      if (!shouldFallbackToMock(config)) {
        throw new Error("research 模式下 live provider 未配置");
      }

      return {
        ...mockData,
        liveMode: "real_unconfigured_fallback_mock",
      };
    }

    return {
      ...mockData,
      liveMatches,
      liveMode: "real",
    };
  } catch (error) {
    if (!shouldFallbackToMock(config)) {
      throw new Error(`research 模式下 live provider 请求失败: ${error.message}`);
    }

    return {
      ...mockData,
      liveMode: "real_fallback_mock",
      liveFallbackReason: error.message,
    };
  }
}

export async function getProviderStatus() {
  const config = getProviderConfig();
  const bundle = await getMarketDataBundle();
  const catalog = getSourceCatalog();
  const adapters = getProviderAdapters();

  return {
    appMode: config.appMode,
    marketDataMode: bundle.mode,
    requestedMarketDataMode: config.marketDataMode,
    requestedLiveDataMode: config.liveDataMode,
    configuredSourceCatalogFile: config.sourceCatalogFile,
    configuredRawMarketBoardFile: config.rawMarketBoardFile,
    marketMatchCount: bundle.rawMarketBoard.length,
    providerHealth: bundle.providerHealth,
    sourceCatalogVersion: catalog.version,
    sourceCount: catalog.sources.length,
    adapterStatus: {
      odds: adapters.odds.isConfigured(),
      polymarket: adapters.polymarket.isConfigured(),
      live: adapters.live.isConfigured(),
      opinions: adapters.opinions.isConfigured(),
      bzzoiro: adapters.bzzoiro.isConfigured(),
    },
    sources: catalog.sources.map((source) => ({
      id: source.id,
      name: source.name,
      category: source.category,
      priority: source.priority,
      integrationStatus: source.integrationStatus,
      access: source.access,
    })),
  };
}
