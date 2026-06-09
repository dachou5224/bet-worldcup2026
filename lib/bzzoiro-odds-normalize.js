import { buildFixtureKey } from "./match-key.js";
import { toDisplayTeamName } from "./team-names.js";

const OUTCOME_BY_SIDE = {
  HOME: "home",
  DRAW: "draw",
  AWAY: "away",
};

function pickLatestUpdatedAt(rows) {
  const timestamps = rows
    .map((row) => row.updatedAt)
    .filter(Boolean)
    .sort();
  return timestamps.at(-1) || new Date().toISOString();
}

function buildBookmakerMarket(homeTeam, awayTeam, rows) {
  const sideOdds = {
    home: null,
    draw: null,
    away: null,
  };

  for (const row of rows) {
    const side = OUTCOME_BY_SIDE[row.outcome];
    if (!side || row.decimalOdds == null) {
      continue;
    }
    sideOdds[side] = row.decimalOdds;
  }

  if (sideOdds.home == null || sideOdds.draw == null || sideOdds.away == null) {
    return null;
  }

  const lastUpdate = pickLatestUpdatedAt(rows);
  return {
    key: "h2h",
    last_update: lastUpdate,
    outcomes: [
      { name: homeTeam, price: sideOdds.home },
      { name: "Draw", price: sideOdds.draw },
      { name: awayTeam, price: sideOdds.away },
    ],
  };
}

export function convertBzzoiroBookmakerOddsToOddsApiEvents(bookmakerOddsByEvent = []) {
  return bookmakerOddsByEvent
    .map((entry) => {
      const event = entry.event || {};
      const homeTeam = event.home_team;
      const awayTeam = event.away_team;
      if (!homeTeam || !awayTeam) {
        return null;
      }

      const h2hRows = (entry.odds || []).filter((row) => row.market === "1x2");
      const rowsByBookmaker = new Map();

      for (const row of h2hRows) {
        const bookmakerKey = row.bookmakerCode || row.bookmaker;
        if (!bookmakerKey || bookmakerKey === "consensus") {
          continue;
        }

        if (!rowsByBookmaker.has(bookmakerKey)) {
          rowsByBookmaker.set(bookmakerKey, []);
        }
        rowsByBookmaker.get(bookmakerKey).push(row);
      }

      const bookmakers = Array.from(rowsByBookmaker.entries())
        .map(([bookmakerKey, rows]) => {
          const market = buildBookmakerMarket(homeTeam, awayTeam, rows);
          if (!market) {
            return null;
          }

          const title = rows[0]?.bookmaker || bookmakerKey;
          return {
            key: bookmakerKey,
            title,
            last_update: market.last_update,
            markets: [market],
          };
        })
        .filter(Boolean);

      if (!bookmakers.length) {
        return null;
      }

      return {
        id: String(event.id || `${homeTeam}-${awayTeam}`),
        sport_key: "soccer_fifa_world_cup",
        sport_title: "FIFA World Cup",
        commence_time: event.event_date || event.kickoff || null,
        home_team: homeTeam,
        away_team: awayTeam,
        bookmakers,
      };
    })
    .filter(Boolean);
}

function normalizeMarket(market) {
  return {
    key: market.key,
    lastUpdate: market.last_update || market.lastUpdate,
    outcomes: (market.outcomes || [])
      .map((outcome) => ({
        name: outcome.name,
        price: outcome.price,
      }))
      .filter((outcome) => outcome.name && outcome.price != null),
  };
}

function normalizeBookmaker(bookmaker, homeTeam, awayTeam) {
  const h2hMarket = (bookmaker.markets || []).find((market) => market.key === "h2h");
  if (!h2hMarket) {
    return null;
  }

  const outcomeMap = new Map(h2hMarket.outcomes.map((outcome) => [outcome.name, outcome.price]));
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

export function convertBzzoiroBookmakerOddsToNormalizedBoard(bookmakerOddsByEvent = []) {
  return convertBzzoiroBookmakerOddsToOddsApiEvents(bookmakerOddsByEvent)
    .map((event) => {
      const homeTeam = toDisplayTeamName(event.home_team);
      const awayTeam = toDisplayTeamName(event.away_team);
      const oddsProviders = (event.bookmakers || [])
        .map((bookmaker) => normalizeBookmaker(bookmaker, event.home_team, event.away_team))
        .filter(Boolean)
        .filter(
          (provider) => provider.odds.home && provider.odds.draw && provider.odds.away,
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
}

export function hasBookmakerOdds(bookmakerOddsByEvent = []) {
  return bookmakerOddsByEvent.some((entry) =>
    (entry.odds || []).some((row) => row.market === "1x2"),
  );
}
