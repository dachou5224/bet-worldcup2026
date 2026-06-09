import https from "node:https";
import { getCachedJsonPayload } from "../../lib/local-json-cache.js";
import { buildFixtureKey } from "../../lib/match-key.js";

let lastFetchMeta = null;

function fetchPolymarketJson(url, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      {
        headers: {
          "User-Agent": "Mozilla/5.0",
          Accept: "application/json,text/plain,*/*",
          Referer: "https://polymarket.com/",
          Origin: "https://polymarket.com",
          "Accept-Language": "en-US,en;q=0.9",
          Connection: "close",
        },
      },
      (response) => {
        let body = "";
        response.setEncoding("utf8");

        response.on("data", (chunk) => {
          body += chunk;
        });

        response.on("end", () => {
          if (response.statusCode && response.statusCode >= 400) {
            reject(
              new Error(
                `HTTP ${response.statusCode} for ${url}: ${body.slice(0, 300)}`,
              ),
            );
            return;
          }

          try {
            resolve(JSON.parse(body));
          } catch (error) {
            reject(
              new Error(
                `Polymarket JSON parse failed for ${url}: ${error.message}; body=${body.slice(0, 300)}`,
              ),
            );
          }
        });
      },
    );

    request.setTimeout(timeoutMs, () => {
      request.destroy(new Error(`Polymarket request timed out after ${timeoutMs}ms`));
    });

    request.on("error", (error) => {
      reject(error);
    });
  });
}

function parseJsonArray(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseOutcomePrices(market) {
  const outcomes = parseJsonArray(market.outcomes);
  const prices = parseJsonArray(market.outcomePrices);

  if (!outcomes.length || !prices.length || outcomes.length !== prices.length) {
    return [];
  }

  return outcomes.map((name, index) => ({
    name,
    price: Number(prices[index]),
  }));
}

function toNumberOrNull(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toNumberArray(values) {
  return values
    .map((value) => toNumberOrNull(value))
    .filter((value) => value != null);
}

function looksLikeFixtureMarket(outcomes) {
  return outcomes.length >= 2 && outcomes.length <= 3;
}

function getEventLabel(event) {
  return `${event.title || ""} ${event.question || ""} ${event.slug || ""}`.trim();
}

function matchesSearchTerms(event, searchTerms) {
  if (!searchTerms.length) {
    return true;
  }

  const label = getEventLabel(event).toLowerCase();
  return searchTerms.some((term) => label.includes(term.toLowerCase()));
}

function normalizePolymarketEvent(event) {
  const markets = Array.isArray(event.markets) ? event.markets : [];
  const candidate = markets
    .map((market) => ({
      provider: "Polymarket",
      updatedAt: market.updatedAt || event.updatedAt || event.endDate,
      marketId: market.id || null,
      conditionId: market.conditionId || null,
      marketSlug: market.slug || null,
      question: market.question || event.question || null,
      outcomesRaw: parseJsonArray(market.outcomes),
      outcomePricesRaw: parseJsonArray(market.outcomePrices),
      enableOrderBook:
        typeof market.enableOrderBook === "boolean"
          ? market.enableOrderBook
          : typeof event.enableOrderBook === "boolean"
            ? event.enableOrderBook
            : null,
      liquidity: toNumberOrNull(market.liquidity ?? market.liquidityNum ?? event.liquidity),
      volume: toNumberOrNull(market.volume ?? market.volumeNum ?? event.volume),
      openInterest: toNumberOrNull(market.openInterest ?? event.openInterest),
      volume24hr: toNumberOrNull(market.volume24hr ?? event.volume24hr),
      volume1wk: toNumberOrNull(market.volume1wk ?? event.volume1wk),
      volume1mo: toNumberOrNull(market.volume1mo ?? event.volume1mo),
      volume1yr: toNumberOrNull(market.volume1yr ?? event.volume1yr),
      outcomes: parseOutcomePrices(market),
    }))
    .find((market) => looksLikeFixtureMarket(market.outcomes));

  if (!candidate) {
    return null;
  }

  const nonDrawOutcomes = candidate.outcomes.filter(
    (outcome) => outcome.name.toLowerCase() !== "draw",
  );

  if (nonDrawOutcomes.length < 2) {
    return null;
  }

  const [homeOutcome, awayOutcome] = nonDrawOutcomes;
  const drawOutcome = candidate.outcomes.find(
    (outcome) => outcome.name.toLowerCase() === "draw",
  );

  const home = homeOutcome.name.trim();
  const away = awayOutcome.name.trim();

  return {
    fixtureKey: buildFixtureKey(home, away),
    fixtureId: event.id,
    home,
    away,
    kickoff: event.startDate || event.start_date || event.endDate,
    predictionMarkets: [
      {
        provider: "Polymarket",
        updatedAt: candidate.updatedAt,
        probabilities: {
          home: Number(homeOutcome.price),
          draw: drawOutcome ? Number(drawOutcome.price) : 0,
          away: Number(awayOutcome.price),
        },
        eventId: event.id,
        eventSlug: event.slug || null,
        marketId: candidate.marketId,
        marketSlug: candidate.marketSlug,
        conditionId: candidate.conditionId,
        question: candidate.question,
        outcomes: candidate.outcomesRaw,
        outcomePrices: toNumberArray(candidate.outcomePricesRaw),
        enableOrderBook: candidate.enableOrderBook,
        liquidity: candidate.liquidity,
        volume: candidate.volume,
        openInterest: candidate.openInterest,
        volume24hr: candidate.volume24hr,
        volume1wk: candidate.volume1wk,
        volume1mo: candidate.volume1mo,
        volume1yr: candidate.volume1yr,
      },
    ],
  };
}

export function createPolymarketGammaProviderAdapter(config) {
  return {
    id: "polymarket_gamma",
    isConfigured() {
      return config.polymarketPublicEnabled;
    },
    getLastFetchMeta() {
      return lastFetchMeta;
    },
    async fetchRawEventsResponse(options = {}) {
      const events = await this.fetchRawEvents(options);
      return {
        body: events,
        meta: lastFetchMeta || {
          capturedAt: new Date().toISOString(),
          fromCache: true,
          sentimentOnly: true,
          directEVEligible: false,
        },
      };
    },
    async fetchRawEvents(options = {}) {
      return getCachedJsonPayload({
        namespace: "polymarket-gamma-events",
        cacheKey: JSON.stringify({
          baseUrl: config.polymarketGammaApiBaseUrl,
          tagId: config.polymarketTagId,
          slug: config.polymarketSlug,
          searchTerms: config.polymarketSearchTerms,
          limit: config.polymarketLimit,
        }),
        ttlSeconds: options.bypassCache ? 0 : config.polymarketCacheTtlSeconds,
        enabled: options.bypassCache ? false : config.providerCacheEnabled,
        cacheDir: config.providerCacheDir,
        fetcher: async () => {
          const params = new URLSearchParams({
            active: "true",
            closed: "false",
            limit: String(config.polymarketLimit),
          });

          if (config.polymarketTagId) {
            params.set("tag_id", String(config.polymarketTagId));
          }

          if (config.polymarketSlug) {
            params.set("slug", config.polymarketSlug);
          }

          const url = `${config.polymarketGammaApiBaseUrl}/events?${params.toString()}`;
        const response = await fetchPolymarketJson(url, options.timeoutMs || 45000);
          const events = Array.isArray(response) ? response : [];
          const filtered = events.filter((event) =>
            matchesSearchTerms(event, config.polymarketSearchTerms),
          );

          lastFetchMeta = {
            capturedAt: new Date().toISOString(),
            fromCache: false,
            sentimentOnly: true,
            directEVEligible: false,
            semanticMappingConfidence: "low",
            eventCount: filtered.length,
            searchTerms: config.polymarketSearchTerms,
          };

          return filtered;
        },
      });
    },
    async fetchNormalizedPredictionMarkets() {
      const events = await this.fetchRawEvents();
      return events.map(normalizePolymarketEvent).filter(Boolean);
    },
  };
}
