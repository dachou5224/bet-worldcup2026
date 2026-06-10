import { buildFixtureKey } from "./match-key.js";
import { normalizeCanonicalEnglishTeamName } from "./goldman-sachs-team-aliases.js";
import { toDisplayTeamName } from "./team-names.js";

/** Polymarket 世界杯单场 slug：fifwc-mex-rsa-2026-06-11 */
export const FIFWC_MATCH_SLUG_PATTERN = /^fifwc-[a-z0-9]+-[a-z0-9]+-\d{4}-\d{2}-\d{2}$/;

/** Polymarket 英文队名 -> The Odds API 英文队名（merge 前对齐） */
const POLYMARKET_TO_ODDS_ENGLISH = {
  "Korea Republic": "South Korea",
  "Bosnia-Herzegovina": "Bosnia & Herzegovina",
  "United States": "USA",
  "IR Iran": "Iran",
  "Cabo Verde": "Cape Verde",
  "Côte d'Ivoire": "Ivory Coast",
  "DR Congo": "Congo DR",
};

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

function toNumberOrNull(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function isFifwcMatchEvent(event) {
  return FIFWC_MATCH_SLUG_PATTERN.test(String(event?.slug || ""));
}

export function parseFifwcFixtureTitle(title) {
  const match = String(title || "").match(/^(.+?)\s+vs\.?\s+(.+)$/i);
  if (!match) {
    return null;
  }

  return {
    homeEnglish: match[1].trim(),
    awayEnglish: match[2].trim(),
  };
}

export function polymarketTeamToOddsBoardName(polymarketEnglishName) {
  const trimmed = String(polymarketEnglishName || "").trim();
  if (!trimmed) {
    return "";
  }

  const oddsEnglish =
    POLYMARKET_TO_ODDS_ENGLISH[trimmed] ||
    normalizeCanonicalEnglishTeamName(trimmed) ||
    trimmed;

  return toDisplayTeamName(oddsEnglish);
}

export function extractFifwcSplitBinaryH2h(event, homeEnglish, awayEnglish) {
  const markets = Array.isArray(event?.markets) ? event.markets : [];
  const homeMarket = markets.find((market) =>
    new RegExp(`Will ${escapeRegExp(homeEnglish)} win`, "i").test(market.question || ""),
  );
  const awayMarket = markets.find((market) =>
    new RegExp(`Will ${escapeRegExp(awayEnglish)} win`, "i").test(market.question || ""),
  );
  const drawMarket = markets.find((market) => /end in a draw/i.test(market.question || ""));

  if (!homeMarket || !awayMarket || !drawMarket) {
    return null;
  }

  const homeYes = toNumberOrNull(parseJsonArray(homeMarket.outcomePrices)[0]);
  const drawYes = toNumberOrNull(parseJsonArray(drawMarket.outcomePrices)[0]);
  const awayYes = toNumberOrNull(parseJsonArray(awayMarket.outcomePrices)[0]);

  if (homeYes == null || drawYes == null || awayYes == null) {
    return null;
  }

  const sum = homeYes + drawYes + awayYes;
  if (sum <= 0) {
    return null;
  }

  const liquidityValues = [homeMarket, drawMarket, awayMarket]
    .map((market) => toNumberOrNull(market.liquidity ?? market.liquidityNum))
    .filter((value) => value != null);
  const volumeValues = [homeMarket, drawMarket, awayMarket]
    .map((market) => toNumberOrNull(market.volume ?? market.volumeNum))
    .filter((value) => value != null);

  return {
    raw: { home: homeYes, draw: drawYes, away: awayYes },
    normalized: {
      home: homeYes / sum,
      draw: drawYes / sum,
      away: awayYes / sum,
    },
    markets: {
      home: homeMarket,
      draw: drawMarket,
      away: awayMarket,
    },
    liquidity: liquidityValues.length ? liquidityValues.reduce((a, b) => a + b, 0) : null,
    volume: volumeValues.length ? volumeValues.reduce((a, b) => a + b, 0) : null,
    updatedAt:
      [homeMarket.updatedAt, drawMarket.updatedAt, awayMarket.updatedAt]
        .filter(Boolean)
        .sort()
        .at(-1) || event.updatedAt || event.endDate,
  };
}

export function normalizeFifwcMatchEvent(event) {
  if (!isFifwcMatchEvent(event)) {
    return null;
  }

  const parsedTitle = parseFifwcFixtureTitle(event.title);
  if (!parsedTitle) {
    return null;
  }

  const { homeEnglish, awayEnglish } = parsedTitle;
  const h2h = extractFifwcSplitBinaryH2h(event, homeEnglish, awayEnglish);
  if (!h2h) {
    return null;
  }

  const home = polymarketTeamToOddsBoardName(homeEnglish);
  const away = polymarketTeamToOddsBoardName(awayEnglish);

  return {
    fixtureKey: buildFixtureKey(home, away),
    fixtureId: event.id,
    home,
    away,
    kickoff: event.endDate || event.startDate,
    predictionMarkets: [
      {
        provider: "Polymarket",
        updatedAt: h2h.updatedAt,
        probabilities: h2h.normalized,
        probabilitiesRaw: h2h.raw,
        eventId: event.id,
        eventSlug: event.slug || null,
        marketId: h2h.markets.home.id || null,
        marketSlug: h2h.markets.home.slug || null,
        conditionId: h2h.markets.home.conditionId || null,
        question: event.title || null,
        marketStructure: "split_binary_h2h",
        directEVEligible: true,
        enableOrderBook: event.enableOrderBook ?? null,
        liquidity: h2h.liquidity,
        volume: h2h.volume,
        openInterest: toNumberOrNull(event.openInterest),
        volume24hr: toNumberOrNull(event.volume24hr),
        outcomes: ["home", "draw", "away"],
        outcomePrices: [h2h.normalized.home, h2h.normalized.draw, h2h.normalized.away],
        sourceMarkets: {
          home: {
            marketId: h2h.markets.home.id,
            slug: h2h.markets.home.slug,
            question: h2h.markets.home.question,
          },
          draw: {
            marketId: h2h.markets.draw.id,
            slug: h2h.markets.draw.slug,
            question: h2h.markets.draw.question,
          },
          away: {
            marketId: h2h.markets.away.id,
            slug: h2h.markets.away.slug,
            question: h2h.markets.away.question,
          },
        },
      },
    ],
  };
}
