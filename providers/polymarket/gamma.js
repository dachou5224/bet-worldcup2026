import { getCachedJsonPayload } from "../../lib/local-json-cache.js";
import {
  describeProxyUsage,
  fetchJsonViaHttpsProxy,
  resolveHttpsProxyUrl,
} from "../../lib/https-proxy-fetch.js";
import {
  isFifwcMatchEvent,
  normalizeFifwcMatchEvent,
} from "../../lib/polymarket-fifwc-normalize.js";

let lastFetchMeta = null;

const POLYMARKET_HEADERS = {
  "User-Agent": "Mozilla/5.0",
  Accept: "application/json,text/plain,*/*",
  Referer: "https://polymarket.com/",
  Origin: "https://polymarket.com",
  "Accept-Language": "en-US,en;q=0.9",
};

function fetchPolymarketJson(url, timeoutMs = 20000, proxyUrl = null) {
  return fetchJsonViaHttpsProxy(url, {
    timeoutMs,
    proxyUrl: proxyUrl ?? resolveHttpsProxyUrl(),
    headers: POLYMARKET_HEADERS,
  });
}

function filterFifwcMatchEvents(events) {
  return (events || []).filter(isFifwcMatchEvent);
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
          sentimentOnly: false,
          directEVEligible: false,
        },
      };
    },
    async fetchRawEvents(options = {}) {
      return getCachedJsonPayload({
        namespace: "polymarket-gamma-events",
        cacheKey: JSON.stringify({
          baseUrl: config.polymarketGammaApiBaseUrl,
          seriesId: config.polymarketFifwcSeriesId,
          tagId: config.polymarketTagId,
          slug: config.polymarketSlug,
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

          if (config.polymarketFifwcSeriesId) {
            params.set("series_id", String(config.polymarketFifwcSeriesId));
          } else if (config.polymarketTagId) {
            params.set("tag_id", String(config.polymarketTagId));
          } else if (config.polymarketSlug) {
            params.set("slug", config.polymarketSlug);
          }

          const url = `${config.polymarketGammaApiBaseUrl}/events?${params.toString()}`;
          const proxyUrl = config.polymarketHttpsProxy || resolveHttpsProxyUrl();
          const response = await fetchPolymarketJson(
            url,
            options.timeoutMs || 45000,
            proxyUrl,
          );
          const events = Array.isArray(response) ? response : [];
          const filtered = filterFifwcMatchEvents(events);
          const proxyInfo = describeProxyUsage(proxyUrl);

          lastFetchMeta = {
            capturedAt: new Date().toISOString(),
            fromCache: false,
            sentimentOnly: false,
            directEVEligible: filtered.length > 0,
            semanticMappingConfidence: filtered.length > 0 ? "high" : "low",
            marketStructure: "split_binary_h2h",
            seriesId: config.polymarketFifwcSeriesId || null,
            eventCount: filtered.length,
            rawEventCount: events.length,
            fetchedVia: proxyInfo.used ? "https_proxy" : "direct",
            proxy: proxyInfo,
          };

          return filtered;
        },
      });
    },
    async fetchNormalizedPredictionMarkets() {
      const events = await this.fetchRawEvents();
      return events.map(normalizeFifwcMatchEvent).filter(Boolean);
    },
  };
}
