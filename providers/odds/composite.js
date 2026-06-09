import { isOddsQuotaError } from "../../lib/snapshot-replay.js";
import { createBzzoiroOddsProviderAdapter } from "./bzzoiro-odds.js";
import { createTheOddsApiProviderAdapter } from "./the-odds-api.js";

function shouldTryBzzoiroFallback(config, error) {
  if (config.oddsProvider === "bzzoiro") {
    return true;
  }

  if (config.oddsProvider !== "auto") {
    return false;
  }

  return isOddsQuotaError(error) || Boolean(error);
}

export function createCompositeOddsProviderAdapter(config) {
  const theOddsApi = createTheOddsApiProviderAdapter(config);
  const bzzoiroOdds = createBzzoiroOddsProviderAdapter(config);
  let lastFetchMeta = null;

  return {
    id: "composite_odds",
    isConfigured() {
      if (config.oddsProvider === "bzzoiro") {
        return bzzoiroOdds.isConfigured();
      }

      if (config.oddsProvider === "the-odds-api") {
        return theOddsApi.isConfigured();
      }

      return theOddsApi.isConfigured() || bzzoiroOdds.isConfigured();
    },
    getLastFetchMeta() {
      return lastFetchMeta || theOddsApi.getLastFetchMeta() || bzzoiroOdds.getLastFetchMeta();
    },
    async fetchRawOddsResponse(options = {}) {
      if (config.oddsProvider === "bzzoiro") {
        const response = await bzzoiroOdds.fetchRawOddsResponse(options);
        lastFetchMeta = response.meta;
        return response;
      }

      if (config.oddsProvider === "the-odds-api" || !bzzoiroOdds.isConfigured()) {
        const response = await theOddsApi.fetchRawOddsResponse(options);
        lastFetchMeta = response.meta;
        return response;
      }

      try {
        const response = await theOddsApi.fetchRawOddsResponse(options);
        lastFetchMeta = response.meta;
        return response;
      } catch (error) {
        if (!shouldTryBzzoiroFallback(config, error)) {
          throw error;
        }

        const fallback = await bzzoiroOdds.fetchRawOddsResponse(options);
        lastFetchMeta = {
          ...(fallback.meta || {}),
          fallbackFrom: "the-odds-api",
          fallbackReason: error.message,
          oddsProvider: "bzzoiro_odds",
        };
        return {
          ...fallback,
          meta: lastFetchMeta,
        };
      }
    },
    async fetchRawOddsBoard(options = {}) {
      const response = await this.fetchRawOddsResponse(options);
      return Array.isArray(response.body) ? response.body : response.body?.events || response.body;
    },
    async fetchNormalizedOddsBoard(options = {}) {
      if (config.oddsProvider === "bzzoiro") {
        const rows = await bzzoiroOdds.fetchNormalizedOddsBoard(options);
        lastFetchMeta = bzzoiroOdds.getLastFetchMeta();
        return rows;
      }

      if (config.oddsProvider === "the-odds-api" || !bzzoiroOdds.isConfigured()) {
        const rows = await theOddsApi.fetchNormalizedOddsBoard();
        lastFetchMeta = theOddsApi.getLastFetchMeta();
        return rows;
      }

      try {
        const rows = await theOddsApi.fetchNormalizedOddsBoard();
        if (rows.length) {
          lastFetchMeta = theOddsApi.getLastFetchMeta();
          return rows;
        }
        throw new Error("The Odds API 返回 0 场可用比赛");
      } catch (error) {
        if (!shouldTryBzzoiroFallback(config, error)) {
          throw error;
        }

        const rows = await bzzoiroOdds.fetchNormalizedOddsBoard(options);
        lastFetchMeta = {
          ...(bzzoiroOdds.getLastFetchMeta() || {}),
          fallbackFrom: "the-odds-api",
          fallbackReason: error.message,
          oddsProvider: "bzzoiro_odds",
        };
        return rows;
      }
    },
  };
}