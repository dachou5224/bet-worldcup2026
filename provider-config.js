import { loadLocalEnv } from "./lib/load-env.js";
import { normalizeAppMode } from "./lib/app-mode.js";

loadLocalEnv();

export function getProviderConfig() {
  return {
    appMode: normalizeAppMode(process.env.APP_MODE),
    marketDataMode: process.env.MARKET_DATA_MODE || "real",
    liveDataMode: process.env.LIVE_DATA_MODE || "real",
    providerCacheEnabled: (process.env.PROVIDER_CACHE_ENABLED || "true") !== "false",
    providerCacheDir: process.env.PROVIDER_CACHE_DIR || "./fixtures/cache",
    sourceCatalogFile:
      process.env.SOURCE_CATALOG_FILE || "./data-source-catalog.json",
    rawMarketBoardFile:
      process.env.RAW_MARKET_BOARD_FILE || "./fixtures/raw-market-board.json",
    jingcaiOfficialFeedMode: process.env.JINGCAI_OFFICIAL_FEED_MODE || "fixture",
    jingcaiOfficialFeedFile:
      process.env.JINGCAI_OFFICIAL_FEED_FILE || "./fixtures/jingcai-official-feed.json",
    jingcaiOfficialFeedUrl: process.env.JINGCAI_OFFICIAL_FEED_URL || "",
    postMatchReviewFile:
      process.env.POST_MATCH_REVIEW_FILE || "./fixtures/snapshots/post-match-review.json",
    backtestRunFile:
      process.env.BACKTEST_RUN_FILE || "./fixtures/snapshots/backtest-run.json",
    oddsApiBaseUrl: process.env.ODDS_API_BASE_URL || "https://api.the-odds-api.com/v4",
    oddsApiKey: process.env.ODDS_API_KEY || "",
    oddsSportKey: process.env.ODDS_SPORT_KEY || "soccer_fifa_world_cup",
    oddsRegions: process.env.ODDS_REGIONS || "eu",
    oddsMarkets: (process.env.ODDS_MARKETS || "h2h")
      .split(",")
      .map((market) => market.trim())
      .filter(Boolean),
    oddsCommenceTimeFrom: process.env.ODDS_COMMENCE_TIME_FROM || "2026-06-11T00:00:00Z",
    oddsCommenceTimeTo: process.env.ODDS_COMMENCE_TIME_TO || "2026-07-19T23:59:59Z",
    oddsCacheTtlSeconds: Number(process.env.ODDS_CACHE_TTL_SECONDS || 1800),
    polymarketGammaApiBaseUrl:
      process.env.POLYMARKET_GAMMA_API_BASE_URL || "https://gamma-api.polymarket.com",
    polymarketPublicEnabled: (process.env.POLYMARKET_PUBLIC_ENABLED || "false") !== "false",
    polymarketTagId: process.env.POLYMARKET_TAG_ID || "",
    polymarketSlug: process.env.POLYMARKET_SLUG || "",
    polymarketSearchTerms: (process.env.POLYMARKET_SEARCH_TERMS || "world cup,世界杯")
      .split(",")
      .map((term) => term.trim())
      .filter(Boolean),
    polymarketLimit: Number(process.env.POLYMARKET_LIMIT || 100),
    polymarketCacheTtlSeconds: Number(process.env.POLYMARKET_CACHE_TTL_SECONDS || 900),
    sportmonksApiBaseUrl:
      process.env.SPORTMONKS_API_BASE_URL || "https://api.sportmonks.com/v3/football",
    sportmonksApiToken: process.env.SPORTMONKS_API_TOKEN || "",
    worldCupOpeningDate: process.env.WORLD_CUP_OPENING_DATE || "2026-06-11",
    sportmonksStartDate: process.env.SPORTMONKS_START_DATE || "2026-06-11",
    sportmonksEndDate: process.env.SPORTMONKS_END_DATE || "2026-07-19",
    footballDataApiBaseUrl:
      process.env.FOOTBALL_DATA_API_BASE_URL || "https://api.football-data.org/v4",
    footballDataApiKey: process.env.FOOTBALL_DATA_API_KEY || "",
    footballDataCompetitionCode: process.env.FOOTBALL_DATA_COMPETITION_CODE || "WC",
    footballDataDateFrom: process.env.FOOTBALL_DATA_DATE_FROM || "2026-06-11",
    footballDataDateTo: process.env.FOOTBALL_DATA_DATE_TO || "2026-07-19",
    footballDataCacheTtlSeconds: Number(process.env.FOOTBALL_DATA_CACHE_TTL_SECONDS || 300),
    bzzoiroApiBaseUrl: process.env.BZZOIRO_API_BASE_URL || "https://sports.bzzoiro.com/api",
    bzzoiroApiToken: process.env.BZZOIRO_API_TOKEN || "",
    bzzoiroDateFrom: process.env.BZZOIRO_DATE_FROM || "2026-06-11",
    bzzoiroDateTo: process.env.BZZOIRO_DATE_TO || "2026-07-19",
    bzzoiroLeague: process.env.BZZOIRO_LEAGUE || "",
    bzzoiroTimeZone: process.env.BZZOIRO_TIMEZONE || "UTC",
    bzzoiroOddsEventLimit: Number(process.env.BZZOIRO_ODDS_EVENT_LIMIT || 8),
    bzzoiroCacheTtlSeconds: Number(process.env.BZZOIRO_CACHE_TTL_SECONDS || 1800),
  };
}
