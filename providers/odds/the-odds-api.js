import { fetchJson } from "../../lib/fetch-json.js";
import { getCachedJsonPayload } from "../../lib/local-json-cache.js";
import { buildFixtureKey } from "../../lib/match-key.js";
import { toDisplayTeamName } from "../../lib/team-names.js";

function extractOutcomeMap(outcomes) {
  const map = new Map();
  for (const outcome of outcomes || []) {
    map.set(outcome.name, outcome.price);
  }
  return map;
}

function normalizeMarket(market) {
  return {
    key: market.key,
    lastUpdate: market.last_update,
    outcomes: (market.outcomes || [])
      .map((outcome) => ({
        name: outcome.name,
        price: outcome.price,
        ...(outcome.point != null ? { point: outcome.point } : {}),
      }))
      .filter((outcome) => outcome.name && outcome.price != null),
  };
}

function getRequestedMarkets(config) {
  return Array.from(new Set(["h2h", ...(config.oddsMarkets || [])]));
}

function normalizeBookmaker(bookmaker, homeTeam, awayTeam) {
  const h2hMarket = (bookmaker.markets || []).find((market) => market.key === "h2h");
  if (!h2hMarket) {
    return null;
  }

  const outcomeMap = extractOutcomeMap(h2hMarket.outcomes);
  const markets = (bookmaker.markets || []).map(normalizeMarket).filter((market) => market.outcomes.length);

  return {
    provider: bookmaker.title || bookmaker.key,
    updatedAt: bookmaker.last_update,
    odds: {
      home: outcomeMap.get(homeTeam),
      draw: outcomeMap.get("Draw"),
      away: outcomeMap.get(awayTeam),
    },
    markets,
  };
}

export function createTheOddsApiProviderAdapter(config) {
  return {
    id: "the_odds_api",
    isConfigured() {
      return Boolean(config.oddsApiKey);
    },
    async fetchRawOddsBoard() {
      if (!this.isConfigured()) {
        throw new Error("The Odds API key 未配置");
      }

      const requestedMarkets = getRequestedMarkets(config);
      return getCachedJsonPayload({
        namespace: "the-odds-api",
        cacheKey: JSON.stringify({
          baseUrl: config.oddsApiBaseUrl,
          sportKey: config.oddsSportKey,
          regions: config.oddsRegions,
          markets: requestedMarkets,
          commenceTimeFrom: config.oddsCommenceTimeFrom || null,
          commenceTimeTo: config.oddsCommenceTimeTo || null,
        }),
        ttlSeconds: config.oddsCacheTtlSeconds,
        enabled: config.providerCacheEnabled,
        cacheDir: config.providerCacheDir,
        fetcher: async () => {
          const params = new URLSearchParams({
            apiKey: config.oddsApiKey,
            regions: config.oddsRegions,
            markets: requestedMarkets.join(","),
            oddsFormat: "decimal",
          });

          if (config.oddsCommenceTimeFrom) {
            params.set("commenceTimeFrom", config.oddsCommenceTimeFrom);
          }

          if (config.oddsCommenceTimeTo) {
            params.set("commenceTimeTo", config.oddsCommenceTimeTo);
          }

          const url = `${config.oddsApiBaseUrl}/sports/${config.oddsSportKey}/odds?${params.toString()}`;
          const response = await fetchJson(url, { timeoutMs: 20000 });
          return response.body;
        },
      });
    },
    async fetchNormalizedOddsBoard() {
      const data = await this.fetchRawOddsBoard();

      return data
        .map((event) => {
          const homeTeam = toDisplayTeamName(event.home_team);
          const awayTeam = toDisplayTeamName(event.away_team);
          const oddsProviders = (event.bookmakers || [])
            .map((bookmaker) => normalizeBookmaker(bookmaker, event.home_team, event.away_team))
            .filter(Boolean)
            .filter(
              (provider) =>
                provider.odds.home && provider.odds.draw && provider.odds.away,
            );

          if (!oddsProviders.length) {
            return null;
          }

          return {
            fixtureKey: buildFixtureKey(homeTeam, awayTeam),
            fixtureId: event.id,
            home: homeTeam,
            away: awayTeam,
            kickoff: event.commence_time,
            oddsProviders,
          };
        })
        .filter(Boolean);
    },
  };
}
