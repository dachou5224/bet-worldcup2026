import { fetchJson } from "../../lib/fetch-json.js";
import { getCachedJsonPayload } from "../../lib/local-json-cache.js";
import { toDisplayTeamName } from "../../lib/team-names.js";

function buildHeaders(config) {
  return {
    Accept: "application/json",
    Authorization: `Token ${config.bzzoiroApiToken}`,
  };
}

function appendOptionalParam(params, key, value) {
  if (value) {
    params.set(key, value);
  }
}

function getEventLabel(event) {
  return `${toDisplayTeamName(event.home_team || "Home TBD")} vs ${toDisplayTeamName(event.away_team || "Away TBD")}`;
}

function normalizeCoach(coach) {
  if (!coach) {
    return null;
  }

  return {
    id: coach.id ?? null,
    name: coach.name || null,
    shortName: coach.short_name || coach.shortName || null,
    country: coach.country || null,
    profile: coach.profile || null,
    preferredFormation: coach.preferred_formation || null,
    pressingIntensity: coach.pressing_intensity ?? null,
    defensiveLine: coach.defensive_line || null,
    topStyles: Array.isArray(coach.top_styles) ? coach.top_styles : [],
  };
}

function normalizeUnavailablePlayers(sidePlayers) {
  return Array.isArray(sidePlayers)
    ? sidePlayers.map((player) => ({
        name: player.name || null,
        status: player.status || null,
        reason: player.reason || null,
        expectedReturn: player.expected_return || null,
      }))
    : [];
}

function normalizeEvent(event) {
  return {
    id: event.id,
    fixture: getEventLabel(event),
    kickoff: event.event_date,
    stage: event.round_name || event.group_name || event.league?.name || "世界杯赛程",
    status: event.status,
    currentMinute: event.current_minute ?? null,
    period: event.period || null,
    score: {
      home: event.home_score,
      away: event.away_score,
      homeHalfTime: event.home_score_ht,
      awayHalfTime: event.away_score_ht,
    },
    odds: {
      home: event.odds_home,
      draw: event.odds_draw,
      away: event.odds_away,
      over15: event.odds_over_15,
      over25: event.odds_over_25,
      over35: event.odds_over_35,
      under15: event.odds_under_15,
      under25: event.odds_under_25,
      under35: event.odds_under_35,
      bttsYes: event.odds_btts_yes,
      bttsNo: event.odds_btts_no,
    },
    xg: {
      actualHome: event.actual_home_xg ?? null,
      actualAway: event.actual_away_xg ?? null,
      liveHome: event.home_xg_live ?? null,
      liveAway: event.away_xg_live ?? null,
    },
    environment: {
      weatherCode: event.weather_code ?? null,
      windSpeed: event.wind_speed ?? null,
      temperatureC: event.temperature_c ?? null,
      pitchCondition: event.pitch_condition || null,
      attendance: event.attendance ?? null,
      referee: event.referee || null,
      isLocalDerby: event.is_local_derby ?? null,
      isNeutralGround: event.is_neutral_ground ?? null,
      travelDistanceKm: event.travel_distance_km ?? null,
    },
    coaches: {
      home: normalizeCoach(event.home_coach),
      away: normalizeCoach(event.away_coach),
    },
    unavailablePlayers: {
      home: normalizeUnavailablePlayers(event.unavailable_players?.home),
      away: normalizeUnavailablePlayers(event.unavailable_players?.away),
    },
    venue: event.home_team_obj?.venue
      ? {
          id: event.home_team_obj.venue.id ?? null,
          name: event.home_team_obj.venue.name || null,
          city: event.home_team_obj.venue.city || null,
          country: event.home_team_obj.venue.country || null,
          capacity: event.home_team_obj.venue.capacity ?? null,
        }
      : null,
    league: event.league
      ? {
          id: event.league.id,
          name: event.league.name,
          country: event.league.country,
        }
      : null,
  };
}

function normalizePrediction(prediction) {
  const event = prediction.event || {};
  return {
    id: prediction.id,
    eventId: event.id ?? null,
    fixture: getEventLabel(event),
    kickoff: event.event_date || null,
    createdAt: prediction.created_at,
    probabilities: {
      home: prediction.prob_home_win,
      draw: prediction.prob_draw,
      away: prediction.prob_away_win,
      over15: prediction.prob_over_15,
      over25: prediction.prob_over_25,
      over35: prediction.prob_over_35,
      bttsYes: prediction.prob_btts_yes,
    },
    expectedGoals: {
      home: prediction.expected_home_goals,
      away: prediction.expected_away_goals,
    },
    mostLikelyScore: prediction.most_likely_score,
    modelVersion: prediction.model_version,
    confidence: prediction.confidence,
  };
}

function normalizeOddsSnapshot(snapshot) {
  return {
    id: snapshot.id,
    market: snapshot.market,
    outcome: snapshot.outcome,
    line: snapshot.line ?? null,
    outcomeName: snapshot.outcome_name,
    bookmaker: snapshot.bookmaker,
    bookmakerCode: snapshot.bookmaker_code,
    decimalOdds: snapshot.decimal_odds,
    previousDecimalOdds: snapshot.previous_decimal_odds ?? null,
    impliedProbability: snapshot.implied_probability,
    isMaxQuote: snapshot.is_max_quote,
    movement: snapshot.movement || null,
    updatedAt: snapshot.updated_at,
  };
}

function normalizePolymarketSnapshot(snapshot) {
  return {
    id: snapshot.id,
    title: snapshot.title || null,
    slug: snapshot.slug || null,
    marketSlug: snapshot.market_slug || null,
    outcome: snapshot.outcome || null,
    outcomeName: snapshot.outcome_name || null,
    price: snapshot.price ?? null,
    previousPrice: snapshot.previous_price ?? null,
    movement: snapshot.movement || null,
    impliedProbability: snapshot.implied_probability ?? null,
    volume: snapshot.volume ?? null,
    liquidity: snapshot.liquidity ?? null,
    updatedAt: snapshot.updated_at || null,
  };
}

async function fetchEventOdds(config, eventId) {
  const response = await fetchJson(`${config.bzzoiroApiBaseUrl}/odds/?event=${eventId}`, {
    timeoutMs: 20000,
    headers: buildHeaders(config),
  });
  const body = response.body || {};

  return {
    event: body.event || { id: eventId },
    count: body.count || 0,
    odds: Array.isArray(body.odds) ? body.odds.map(normalizeOddsSnapshot) : [],
  };
}

async function fetchEventPolymarketOdds(config, eventId) {
  const response = await fetchJson(
    `${config.bzzoiroApiBaseUrl}/odds/polymarket/?event=${eventId}`,
    {
      timeoutMs: 20000,
      headers: buildHeaders(config),
    },
  );
  const body = response.body || {};

  return {
    eventId,
    count: body.count || 0,
    odds: Array.isArray(body.results) ? body.results.map(normalizePolymarketSnapshot) : [],
  };
}

async function fetchOddsBatches(config, eventIds, batchSize = 2) {
  const bookmakerOddsByEvent = [];
  const polymarketOddsByEvent = [];
  const warnings = [];

  for (let index = 0; index < eventIds.length; index += batchSize) {
    const batch = eventIds.slice(index, index + batchSize);
    const results = await Promise.allSettled(
      batch.map(async (eventId) => ({
        eventId,
        bookmakerOdds: await fetchEventOdds(config, eventId),
        polymarketOdds: await fetchEventPolymarketOdds(config, eventId),
      })),
    );

    for (const result of results) {
      if (result.status === "fulfilled") {
        bookmakerOddsByEvent.push(result.value.bookmakerOdds);
        polymarketOddsByEvent.push(result.value.polymarketOdds);
        continue;
      }

      warnings.push(result.reason instanceof Error ? result.reason.message : String(result.reason));
    }
  }

  return {
    bookmakerOddsByEvent,
    polymarketOddsByEvent,
    warnings,
  };
}

export function createBzzoiroSupplementalProviderAdapter(config) {
  return {
    id: "bzzoiro_sports_data",
    isConfigured() {
      return Boolean(config.bzzoiroApiToken);
    },
    async fetchSupplementalSignals() {
      if (!this.isConfigured()) {
        throw new Error("Bzzoiro API token 未配置");
      }

      return getCachedJsonPayload({
        namespace: "bzzoiro-supplemental-signals",
        cacheKey: JSON.stringify({
          baseUrl: config.bzzoiroApiBaseUrl,
          dateFrom: config.bzzoiroDateFrom,
          dateTo: config.bzzoiroDateTo,
          league: config.bzzoiroLeague,
          timezone: config.bzzoiroTimeZone,
          oddsEventLimit: config.bzzoiroOddsEventLimit,
        }),
        ttlSeconds: config.bzzoiroCacheTtlSeconds,
        enabled: config.providerCacheEnabled,
        cacheDir: config.providerCacheDir,
        fetcher: async () => {
          const eventParams = new URLSearchParams({
            date_from: config.bzzoiroDateFrom,
            date_to: config.bzzoiroDateTo,
            limit: "50",
            full: "true",
            tz: config.bzzoiroTimeZone,
          });
          appendOptionalParam(eventParams, "league", config.bzzoiroLeague);

          const predictionParams = new URLSearchParams({
            date_from: config.bzzoiroDateFrom,
            date_to: config.bzzoiroDateTo,
            page: "1",
            tz: config.bzzoiroTimeZone,
            upcoming: "true",
          });
          appendOptionalParam(predictionParams, "league", config.bzzoiroLeague);

          const [eventsResponse, predictionsResponse] = await Promise.all([
            fetchJson(`${config.bzzoiroApiBaseUrl}/events/?${eventParams.toString()}`, {
              timeoutMs: 20000,
              headers: buildHeaders(config),
            }),
            fetchJson(`${config.bzzoiroApiBaseUrl}/predictions/?${predictionParams.toString()}`, {
              timeoutMs: 20000,
              headers: buildHeaders(config),
            }),
          ]);

          const events = Array.isArray(eventsResponse.body?.results)
            ? eventsResponse.body.results.map(normalizeEvent)
            : [];
          const predictions = Array.isArray(predictionsResponse.body?.results)
            ? predictionsResponse.body.results.map(normalizePrediction)
            : [];
          const candidateEventIds = events
            .map((event) => event.id)
            .filter((id) => id != null)
            .slice(0, Math.max(0, config.bzzoiroOddsEventLimit || 0));
          const { bookmakerOddsByEvent, polymarketOddsByEvent, warnings } =
            await fetchOddsBatches(config, candidateEventIds);

          return {
            checkedAt: new Date().toISOString(),
            events,
            predictions,
            bookmakerOddsByEvent,
            polymarketOddsByEvent,
            warnings,
          };
        },
      });
    },
  };
}
