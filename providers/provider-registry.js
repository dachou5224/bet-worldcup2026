import { validateRawMarketBoard } from "../schemas/market-board.js";
import { validateExpertOpinions } from "../schemas/expert-opinions.js";
import { validateLiveMatches } from "../schemas/live-matches.js";
import { getProviderConfig } from "../provider-config.js";
import {
  getAnalysisItems,
  getCompletedComparisons,
  getExpertOpinions,
  getLiveMatches,
  getModelingSteps,
  getRawMarketBoard,
} from "./mock/index.js";
import { createOddsProviderAdapter } from "./odds/index.js";
import { createOpinionProviderAdapter } from "./opinions/index.js";
import { createPolymarketProviderAdapter } from "./polymarket/index.js";
import { createBzzoiroSupplementalProviderAdapter } from "./context/bzzoiro.js";
import { createFootballDataLiveProviderAdapter } from "./live/football-data.js";
import { createSportmonksLiveProviderAdapter } from "./live/sportmonks.js";
import { createTheOddsApiProviderAdapter } from "./odds/the-odds-api.js";
import { createPolymarketGammaProviderAdapter } from "./polymarket/gamma.js";

export function getMockProvider() {
  return {
    id: "mock_provider",
    getStaticPageData() {
      const liveMatches = getLiveMatches();
      const expertOpinions = getExpertOpinions();
      const liveValidation = validateLiveMatches(liveMatches);
      const expertValidation = validateExpertOpinions(expertOpinions);

      if (!liveValidation.ok) {
        throw new Error(`Mock live 数据不合法: ${liveValidation.errors.join("; ")}`);
      }

      if (!expertValidation.ok) {
        throw new Error(`Mock 专家观点数据不合法: ${expertValidation.errors.join("; ")}`);
      }

      return {
        liveMatches,
        completedComparisons: getCompletedComparisons(),
        analysisItems: getAnalysisItems(),
        modelingSteps: getModelingSteps(),
        expertOpinions,
      };
    },
    getRawMarketBoard() {
      const rawMarketBoard = getRawMarketBoard();
      const validation = validateRawMarketBoard(rawMarketBoard);

      if (!validation.ok) {
        throw new Error(`Mock provider 数据不合法: ${validation.errors.join("; ")}`);
      }

      return rawMarketBoard;
    },
  };
}

export function getProviderAdapters() {
  const config = getProviderConfig();
  const footballDataLive = createFootballDataLiveProviderAdapter(config);
  const sportmonksLive = createSportmonksLiveProviderAdapter(config);

  return {
    odds: createTheOddsApiProviderAdapter(config),
    polymarket: createPolymarketGammaProviderAdapter(config),
    live: footballDataLive.isConfigured() ? footballDataLive : sportmonksLive,
    opinions: createOpinionProviderAdapter(),
    bzzoiro: createBzzoiroSupplementalProviderAdapter(config),
  };
}
