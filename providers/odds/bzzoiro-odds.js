import { fetchJson } from "../../lib/fetch-json.js";
import {
  convertBzzoiroBookmakerOddsToNormalizedBoard,
  convertBzzoiroBookmakerOddsToOddsApiEvents,
  hasBookmakerOdds,
} from "../../lib/bzzoiro-odds-normalize.js";
import { getCachedJsonPayload } from "../../lib/local-json-cache.js";
import { readLatestBzzoiroOddsSource } from "../../lib/bzzoiro-odds-source.js";

function buildHeaders(config) {
  return {
    Accept: "application/json",
    Authorization: `Token ${config.bzzoiroApiToken}`,
  };
}

async function fetchEvents(config) {
  const params = new URLSearchParams({
    date_from: config.bzzoiroDateFrom,
    date_to: config.bzzoiroDateTo,
    limit: String(config.bzzoiroOddsEventLimit || 8),
    full: "true",
    tz: config.bzzoiroTimeZone,
  });

  if (config.bzzoiroLeague) {
    params.set("league", config.bzzoiroLeague);
  }

  const response = await fetchJson(`${config.bzzoiroApiBaseUrl}/events/?${params.toString()}`, {
    timeoutMs: 20000,
    headers: buildHeaders(config),
  });

  return Array.isArray(response.body?.results) ? response.body.results : [];
}

async function fetchEventOdds(config, event) {
  const response = await fetchJson(`${config.bzzoiroApiBaseUrl}/odds/?event=${event.id}`, {
    timeoutMs: 20000,
    headers: buildHeaders(config),
  });
  const body = response.body || {};

  return {
    event: {
      id: event.id,
      home_team: event.home_team,
      away_team: event.away_team,
      event_date: event.event_date,
    },
    count: body.count || 0,
    odds: Array.isArray(body.odds)
      ? body.odds.map((snapshot) => ({
          market: snapshot.market,
          outcome: snapshot.outcome,
          bookmaker: snapshot.bookmaker,
          bookmakerCode: snapshot.bookmaker_code,
          decimalOdds: snapshot.decimal_odds,
          updatedAt: snapshot.updated_at,
        }))
      : [],
  };
}

async function fetchLiveBookmakerOddsByEvent(config) {
  const events = await fetchEvents(config);
  const bookmakerOddsByEvent = [];

  for (const event of events) {
    bookmakerOddsByEvent.push(await fetchEventOdds(config, event));
  }

  return bookmakerOddsByEvent;
}

export function createBzzoiroOddsProviderAdapter(config) {
  let lastFetchMeta = null;

  return {
    id: "bzzoiro_odds",
    isConfigured() {
      return Boolean(config.bzzoiroApiToken);
    },
    getLastFetchMeta() {
      return lastFetchMeta;
    },
    async fetchRawOddsResponse(options = {}) {
      const payload = await this.fetchRawOddsBoard(options);
      return {
        body: payload.events,
        meta: lastFetchMeta,
      };
    },
    async fetchRawOddsBoard(options = {}) {
      if (!this.isConfigured()) {
        throw new Error("Bzzoiro API token 未配置");
      }

      if (options.useSnapshotFallback !== false) {
        const snapshotSource = readLatestBzzoiroOddsSource(config.providerCacheDir);
        if (snapshotSource && hasBookmakerOdds(snapshotSource.bookmakerOddsByEvent)) {
          const events = convertBzzoiroBookmakerOddsToOddsApiEvents(snapshotSource.bookmakerOddsByEvent);
          lastFetchMeta = {
            capturedAt: snapshotSource.cachedAt || new Date().toISOString(),
            fromCache: true,
            sourceMode: "file_snapshot",
            sourceFile: snapshotSource.absolutePath,
            eventCount: events.length,
          };
          return { events, bookmakerOddsByEvent: snapshotSource.bookmakerOddsByEvent };
        }
      }

      const bookmakerOddsByEvent = await getCachedJsonPayload({
        namespace: "bzzoiro-odds-board",
        cacheKey: JSON.stringify({
          baseUrl: config.bzzoiroApiBaseUrl,
          dateFrom: config.bzzoiroDateFrom,
          dateTo: config.bzzoiroDateTo,
          league: config.bzzoiroLeague,
          oddsEventLimit: config.bzzoiroOddsEventLimit,
        }),
        ttlSeconds: options.bypassCache ? 0 : config.bzzoiroCacheTtlSeconds,
        enabled: options.bypassCache ? false : config.providerCacheEnabled,
        cacheDir: config.providerCacheDir,
        fetcher: async () => fetchLiveBookmakerOddsByEvent(config),
      });

      if (!hasBookmakerOdds(bookmakerOddsByEvent)) {
        const snapshotSource = readLatestBzzoiroOddsSource(config.providerCacheDir);
        if (snapshotSource) {
          lastFetchMeta = {
            capturedAt: snapshotSource.cachedAt || new Date().toISOString(),
            fromCache: true,
            sourceMode: "file_snapshot",
            sourceFile: snapshotSource.absolutePath,
            eventCount: snapshotSource.bookmakerOddsByEvent.length,
            liveFetchEmpty: true,
          };
          return {
            events: convertBzzoiroBookmakerOddsToOddsApiEvents(snapshotSource.bookmakerOddsByEvent),
            bookmakerOddsByEvent: snapshotSource.bookmakerOddsByEvent,
          };
        }

        throw new Error("Bzzoiro live odds 返回空结果，且无可用快照回退");
      }

      const events = convertBzzoiroBookmakerOddsToOddsApiEvents(bookmakerOddsByEvent);
      lastFetchMeta = {
        capturedAt: new Date().toISOString(),
        fromCache: false,
        sourceMode: "real",
        eventCount: events.length,
      };

      return { events, bookmakerOddsByEvent };
    },
    async fetchNormalizedOddsBoard(options = {}) {
      const payload = await this.fetchRawOddsBoard(options);
      return convertBzzoiroBookmakerOddsToNormalizedBoard(payload.bookmakerOddsByEvent);
    },
  };
}
